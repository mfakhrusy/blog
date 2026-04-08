# AMD GPU Programming on MI300X: A Weekend Experiment

## Overview
This experiment documents my journey exploring AMD GPU programming options on the MI300X (CDNA3 architecture) through the AMD Developer Cloud. I tested various approaches from high-level PyTorch to low-level kernel development frameworks.

---

## Environment Setup

### Hardware
- **GPU**: AMD MI300X (CDNA3, gfx942)
- **Architecture**: CDNA3 (not CDNA4/MI355X)
- **Memory**: 192 GB HBM3
- **Compute Units**: 304 CUs

### Software Stack
- **OS**: Ubuntu 22.04 (WSL2 attempted, failed)
- **ROCm Version**: 6.2.41133 (native Linux), 7.0-preview (container)
- **PyTorch**: 2.5.1+rocm6.2, 2.8.0+rocm7.0
- **Container**: `rocm/7.0-preview:rocm7.0_preview_pytorch_training_mi35x_beta`

### Access Method
- AMD Developer Cloud (25 free hours)
- Podman containers with privileged GPU access

---

## Experiment 1: WSL2 Compatibility (Failed)

### Objective
Test if Ryzen AI 7 APU (Radeon 890M/880M) supports ROCm GPU programming on WSL2.

### Procedure
1. Installed ROCm 7.2 on WSL2 Ubuntu 24.04
2. Ran `rocminfo` to detect GPU

### Results
$ rocminfo
WSL environment detected.
pid:568752 tid:0x7c44f5aeb100 [topology_sysfs_get_system_props] No WDDM adapters found.
hsa_init Failed, possibly no supported GPU devices
plain
Copy

### Analysis
- **Root Cause**: Ryzen AI 300-series APUs (gfx1150) are not properly supported in WSL2
- AMD's WSL2 driver does not enumerate Radeon 890M/880M iGPUs correctly
- The "No WDDM adapters found" error is a known issue for Strix Point APUs

### Conclusion
WSL2 is **not viable** for Ryzen AI APU GPU programming. Native Linux or Windows PyTorch with ROCm are the only working options.

---

## Experiment 2: AMD Developer Cloud Setup (Success)

### Objective
Get access to proper AMD GPU hardware for testing.

### Procedure
1. Joined AMD AI Developer Program (received $100 credits)
2. Requested GPU Droplet on AMD Developer Cloud
3. Pulled ROCm container with Podman

### Commands Used
```bash
# Pull container
podman pull docker.io/rocm/7.0-preview:rocm7.0_preview_pytorch_training_mi35x_beta

# Run with GPU access
podman run -it \
    --ipc=host --network=host --privileged \
    --cap-add=CAP_SYS_ADMIN --cap-add=SYS_PTRACE \
    --security-opt seccomp=unconfined \
    --device=/dev/kfd --device=/dev/dri \
    -v $(pwd):/workdir/ \
    docker.io/rocm/7.0-preview:rocm7.0_preview_pytorch_training_mi35x_beta \
    bash
Results
Successfully accessed MI300X GPU
ROCm 7.0 runtime loaded correctly
PyTorch with ROCm support functional
Experiment 3: AITER Performance Kernels (Partial Success)
Objective
Test AMD's official optimized kernel library (AITER).
Procedure
Python
Copy
import aiter

# Flash Attention
out_aiter, softmax_lse = aiter.flash_attn_func(
    Q_aiter, K_aiter, V_aiter, 
    causal=True, return_lse=True, deterministic=False
)

# GEMM
from aiter.tuned_gemm import tgemm
C_aiter = tgemm.mm(A, B, None, None, None)
Results
Issue: JIT compilation segfault on MI300X (CDNA3)
Aiter attempted to build kernel mha_fwd_fp16_nbias_nmask_nlse_ndropout on-the-fly
Build succeeded (65s) but execution crashed with "Segmentation fault (core dumped)"
Analysis
AITER container was built for MI350X/MI355X (CDNA4, gfx950)
MI300X uses CDNA3 (gfx942) — different architecture
JIT kernel cache may have CDNA4-specific optimizations incompatible with CDNA3
Conclusion
AITER works best on CDNA4 (MI350X/MI355X). CDNA3 support is limited or requires different container tags.
Experiment 4: Triton on ROCm (Success)
Objective
Test OpenAI Triton for writing custom GPU kernels on AMD.
Setup
bash
Copy
pip install triton
Test 1: Vector Addition (Element-wise)
Python
Copy
import triton
import triton.language as tl

@triton.jit
def add_kernel(x_ptr, y_ptr, output_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    pid = tl.program_id(axis=0)
    block_start = pid * BLOCK_SIZE
    offsets = block_start + tl.arange(0, BLOCK_SIZE)
    mask = offsets < n_elements
    
    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)
    output = x + y
    tl.store(output_ptr + offsets, output, mask=mask)
Results:
Correctness: ✅ Max diff 0.000000
Performance: 0.012 ms (Triton) vs 0.005 ms (PyTorch)
Overhead: ~2.4x slower than PyTorch native
Test 2: GeLU Activation (Fused)
Python
Copy
@triton.jit
def gelu_kernel(x_ptr, output_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    # GeLU: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
    sqrt_2_over_pi = 0.7978845608028654
    x_cubed = x * x * x
    inner = sqrt_2_over_pi * (x + 0.044715 * x_cubed)
    exp_2x = tl.exp(2.0 * inner)
    tanh_inner = (exp_2x - 1.0) / (exp_2x + 1.0)
    gelu = 0.5 * x * (1.0 + tanh_inner)
Results:
Correctness: ✅ Max diff 0.000473 (acceptable for FP16)
Performance: 0.013 ms (Triton) vs 0.005 ms (PyTorch)
Test 3: Matrix Multiplication (Tiled)
Python
Copy
@triton.jit
def matmul_kernel(a_ptr, b_ptr, c_ptr, M, N, K, ...):
    # Block-tiled matmul with accumulator
    accumulator = tl.zeros((BLOCK_SIZE_M, BLOCK_SIZE_N), dtype=tl.float32)
    for k in range(0, tl.cdiv(K, BLOCK_SIZE_K)):
        a = tl.load(a_ptrs, mask=...)
        b = tl.load(b_ptrs, mask=...)
        accumulator += tl.dot(a, b)
Results:
Correctness: ⚠️ Max diff 0.062500 (FP16 accumulation order)
Performance: 0.057 ms (Triton) vs 0.024 ms (PyTorch/rocBLAS)
Overhead: ~2.4x slower than optimized BLAS
Analysis
Triton on ROCm works but has limitations:
Register lifetime tracking issues (per HipKittens paper)
Suboptimal memory access lowering
Missing some tl functions (e.g., tanh not available, used exp approximation)
Performance gap vs. hand-optimized assembly (AITER/HipKittens)
Key Findings
1. Architecture Differences Matter
Table
Copy
Feature	CDNA3 (MI300X)	CDNA4 (MI355X)
FP6 Support	❌ No	✅ Yes
Peak BF16	~1.3 PFLOPS	~2.5 PFLOPS
Memory	192 GB	288 GB
Optimal Schedules	4-wave/8-wave	8-wave ping-pong
2. Software Stack Maturity
PyTorch/rocBLAS: Production-ready, best performance
AITER: Fast but CDNA4-focused, CDNA3 support spotty
Triton: Functional but ~50% performance vs. CUDA Triton
HipKittens: Research C++ DSL, not Python
3. WSL2 Status
Ryzen AI APUs are not supported for ROCm GPU computing in WSL2. Use native Windows PyTorch or dual-boot Linux.

For Kernel Research
AITER: If on CDNA4 (MI350X/MI355X)
HipKittens: If you need assembly-level performance and can write C++
Triton: For prototyping, but expect 2-3x slowdown vs. optimal
For Ryzen AI APU Owners
Skip WSL2. Use:
Native Windows PyTorch with ROCm
Native Linux (Fedora 42 or Ubuntu 24.04) with HSA_OVERRIDE_GFX_VERSION=11.0.0
References
HipKittens Paper: HipKittens: Fast and Furious AMD Kernels
AMD Developer Cloud: https://devcloud.amd.com
ROCm Documentation: https://rocm.docs.amd.com
Appendix: Useful Commands
bash
Copy
# Check GPU
rocminfo | grep "Name:"

# Check PyTorch ROCm
python -c "import torch; print(torch.__version__); print(torch.version.hip)"

# Environment variables for debugging
export HSA_OVERRIDE_GFX_VERSION=gfx942
export AITER_ARCH=gfx942
Experiment conducted on AMD Developer Cloud with MI300X GPUs. Total compute time: ~3 hours across multiple sessions.
plain
Copy

This gives you a solid foundation for a technical blog post. Want me to expand any section or add more details about specific errors encountered?

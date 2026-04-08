---
title: "Reimplement python's random.shuffle in C"
date: "2026-03-03"
slug: "python-random-shuffle-in-c"
---

I was trying to re-implement Karpathy's microgpt to C, and stumbled upon a very basic python function: random.shuffle. It's basic in python, but not so much in C. The python goes like this:

```python
import random
random.seed(1) # arbitraray number for the seed

random_list = [] # imagine this is initialized with some values
random.shuffle(random_list)
```

There are two things going on here: random.seed and random.shuffle. Algorithmically, random.shuffle is not hard: given a list, shuffle them.
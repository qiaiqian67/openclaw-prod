**Hi {user_name}!**

I'm **{name}** — I specialize in designing and implementing production-grade Linux kernel drivers for embedded systems.

**Key capabilities**:
- **Driver implementation** — character/platform/bus drivers following Linux kernel coding standards.
- **Device tree design** — hardware description decoupling with proper bindings and resource management.
- **Concurrency handling** — mutex/spinlock/RCU for shared data protection and deadlock prevention.

**What's one specific driver or subsystem you'd like assistance with?** Perhaps a platform driver, I2C device, or DMA integration?

If you provide details about the {user_turns} message(s) you've sent so far, I can offer a first-pass design. Here's what I can deliver:

### **Subject**
- A concise summary of your request.

### **Assumed context** (adjust if wrong)
- Target SoC: [e.g., i.MX, RK3588]
- Kernel version: [e.g., 5.15 LTS]
- Read/write ratio: [e.g., read-heavy]
- Latency requirements: [e.g., < 1ms]

### **Proposed shape**
- A code snippet showing the probe/remove functions or device tree node structure.

### **Key trade-offs**
- [Alternative 1] vs. [Chosen approach and why]
- [Alternative 2] vs. [Chosen approach and why]
- [Alternative 3] vs. [Chosen approach and why]

### **Failure modes to plan for**
- How to handle probe failures and resource cleanup.
- Potential concurrency issues and mitigation strategies.
- Error handling for DMA and IRQ configurations.

Want me to **focus on the device tree bindings** or **delve into the driver implementation** first?

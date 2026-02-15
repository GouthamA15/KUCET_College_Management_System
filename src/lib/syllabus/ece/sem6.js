export const semester6 = [
  {
    "code": "PC3201EC",
    "title": "Digital Signal Processing",
    "units": [
      { "name": "UNIT-I Introduction", "topics": ["Introduction: Review of Discrete Time Fourier Transform, Concept of frequency in continuous and discrete time signals, DFT and its properties, linear convolution, circular convolution. Computational complexity of direct Computation of DFT, Fast Fourier Transform, DIT and DIF, FFT algorithms for RADIX-2 case, in-place computation, Bit reversal, Finite word length effects in FFT algorithms, Use of FFT in Linear Filtering."] },
      { "name": "UNIT-II FIR Filters", "topics": ["FIR Filters: FIR digital filter design techniques. Properties of FIR digital filters, design of FIR filters using windows and frequency sampling techniques, linear phase characteristics. Realization diagrams for IIR and FIR filters, finite word length effects."] },
      { "name": "UNIT-III IIR Filters", "topics": ["IIR Filters: Analog filter design – Butterworth and Chebyshev approximations, IIR digital filter design techniques, impulse invariant technique. Bilinear transform technique. Comparison of FIR and IIR filters, frequency transformations."] },
      { "name": "UNIT- IV Multirate signal processing", "topics": ["Multirate signal processing: Introduction, decimation by a factor D, interpolation by a factor I, sampling rate conversion by a rational factor I/D, design of practical sampling rate converter, S/W implementation of sampling rate converter, application of Multirate signal processing."] },
      { "name": "UNIT-V DSP Processors", "topics": ["DSP Processors: Introduction to Fixed point Digital Signal Processors, TMS 320C54XX processor- architecture, addressing modes, instruction set, Assembly programming, programming issues, Applications of DSP processors."] }
    ]
  },
  {
    "code": "PC3202EC",
    "title": "VLSI Design",
    "units": [
      { "name": "UNIT – I Intro", "topics": ["Design Abstraction in Digital circuits, Fabrication process flow of nMOS and pMOS transistors, Overview of CMOS and BiCMOS technologies, MOSFET Transistor under static conditions, channel Length Modulation, Velocity Saturation, Sub-threshold Condition, Threshold variations, MOS structure Capacitance, CMOS Latch up, Technology scaling."] },
      { "name": "UNIT – II CMOS Inverter", "topics": ["CMOS Inverter, Voltage Transfer Characteristics, Static Power Consumption, Dynamic Power Consumption, Propagation Delay, Power-Energy and Energy-Delay Product, Layout Design of basic gates, Silicon on Insulation Technology, FinFET, Comparison of SOI and FinFET."] },
      { "name": "UNIT – III Combinational Logic", "topics": ["Designing Combinational Logic gates in CMOS: Complementary CMOS, Ratioed Logic, Pass Transistor Logic, Dynamic CMOS logic-basic principle, Signal integrity issues in Dynamic Design, domino logic, np-CMOS logic, Merits and Demerits of above logic styles. Designing sequential logic: Bistability Principle, Multiplexer based latch, Dynamic latch, Pipelining."] },
      { "name": "UNIT – IV Arithmetic Building Blocks", "topics": ["Designing Arithmetic Building Blocks: Adder, Binary Adder, Full Adder, and Mirror Adder, Transmission gate-based Adder, Manchester Carry Chain Adder, Carry Bypass Adder, Carry Look ahead Adder, Carry Save Adder, Multiplier, Carry Save Multiplier, Barrel Shifter, and Logarithmic Shifter. Design of Memory Structures: ROM cells, PROM, EPROM, EEPROM, Flash Memory, SDRAM and DRAM."] },
      { "name": "UNIT – V Implementation strategies", "topics": ["Implementation of strategies for Digital ICs, Testing of VLSI circuits: VLSI Chip Yield, Test procedures; Design for Testability- Ad Hoc Testing, Scan Based testing, Boundary Scan Design, Built in Self-Test, Built-in logic block observer, Test Pattern Generator, Automatic Test Pattern Generation (ATPG)."] }
    ]
  },
  {
    "code": "PC3203EC",
    "title": "Data Communication and Computer Networks",
    "units": [
      { "name": "UNIT - I Data communication", "topics": ["Data communication: A Communication Model, The Need for Protocol Architecture and Standardization, Network Types: LAN, WAN, MAN. Network Topologies: Bus, Star, Ring, Hybrid. Circuit switching: Circuit Switching Principles andconcepts. Packet switching: Virtual circuit and Datagram subnets, X.25."] },
      { "name": "UNIT - II Data Link Layer", "topics": ["Data Link Layer: Need for Data Link Control, Design issues, Framing, Error Detection and Correction, Flow control Protocols: Stop and Wait, Sliding Window, ARQ Protocols, HDLC. MAC Sub Layer: Multiple Access Protocols: ALOHA, CSMA, Wireless LAN. IEEE 802.2, 802.3, 802.4, 802.11, 802.15, 802.16 standards. Bridges and Routers."] },
      { "name": "UNIT - III Network Layer", "topics": ["Network Layer: Network layer Services, Routing algorithms: Shortest Path Routing, Flooding, Hierarchical routing, Broadcast, Multicast, Distance Vector Routing, and Congestion Control Algorithms. Internet Working: The Network Layer in Internet: IPV4, IPV6, Comparison of IPV4 and IPV6, IP Addressing, ATMNetworks."] },
      { "name": "UNIT - IV Transport Layer", "topics": ["Transport Layer: Transport Services, Elements of Transport Layer, Connection management, TCP and UDP protocols, ATM AAL Layer Protocol."] },
      { "name": "UNIT - V Application Layer", "topics": ["Application Layer: Domain Name System, SNMP, Electronic Mail, World Wide Web. Network Security: Cryptography Symmetric Key and Public Key algorithms, Digital Signatures, Authentication Protocols."] }
    ]
  },
  {
    "code": "PE-II*",
    "title": "Professional Elective – II",
    "isGroup": true,
    "variants": [
      {
        "code": "PE3204EC",
        "title": "Embedded System Design",
        "units": [
          { "name": "UNIT-I Intro", "topics": ["Introduction to Embedded Systems: The Embedded Design Life Cycle - Product Specification, Hardware/Software Partitioning, Iteration and Implementation, Detailed Hardware (selection of processor) and Software Design, Hardware/Software Integration, Product Testing and Release, Maintenance and Upgradation."] },
          { "name": "UNIT-II ARM", "topics": ["ARM Embedded Systems: The RISC design philosophy, The ARM design philosophy, ARM processor fundamentals, registers, current program status register, pipeline, exceptions, interrupts, and vector table, core extensions, architecture revisions, ARM processor families."] },
          { "name": "UNIT-III FPGA", "topics": ["Embedded processing with ARM CORTEX on Zynq: Fundamentals of FPGA, types of FPGA, case study of Xilinx FPGA, Processing System, programmable logic, programmable logic interfaces, security, Zynq 7000 family members, Zynq versus standard FPGA, Zynq versus standard processor."] },
          { "name": "UNIT-IV Tools", "topics": ["Embedded Software Development Tools: Host and Target Machines, Cross Compilers, Cross Assemblers, Tool Chains, Linkers/Locators for Embedded Software, Address Resolution, Locator Maps. Getting Embedded Software into Target System: PROM programmer, ROM emulator, In Circuit- Emulators, Monitors, Testing on Your Host Machine - Instruction Set Simulators, Logic Analyzers."] },
          { "name": "UNIT-V RTOS", "topics": ["Introduction to Real Time Operating Systems: Tasks and task states, tasks and Data, Semaphores and shared data. Operating system services: Message queues, mailboxes and pipes, timer functions, events, memory management, Interrupt routines in an RTOS environment."] }
        ]
      },
      {
        "code": "PE3206EC",
        "title": "Artificial Neural Networks and Fuzzy Logic",
        "units": [
          { "name": "Unit –I Introduction", "topics": ["Introduction to Neural Networks: Introduction, Biological Neuron, Biological and Artificial Neuron Models, Characteristics of ANN, McCulloch-Pitts Model, Essentials of Artificial Neural Networks: Types of Neuron Activation Function, ANN Architectures, Classification Taxonomy of ANN – Connectivity, Neural Dynamics (Activation and Synaptic), Learning Strategy (Supervised, Unsupervised, Reinforcement), Learning Rules, Applications of ANN."] },
          { "name": "Unit- II Feed Forward Neural Networks", "topics": ["Feed Forward Neural Networks: Single Layer: Introduction, Perceptron Models: Discrete, Continuous and Multi-Category, Training Algorithms: Discrete and Continuous Perceptron Networks, Perceptron Convergence theorem, Limitations of the Perceptron Model, Applications. Multilayer: Generalized Delta Rule, Derivation of Back propagation (BP) Training, Summary of Back propagation Algorithm, Kolmogorov Theorem"] },
          { "name": "Unit–III Associative Memories", "topics": ["Associative Memories: Paradigms of Associative Memory, Pattern Mathematics, Hebbian Learning, General Concepts of Associative Memory, Bidirectional Associative Memory (BAM) Architecture, BAM Training Algorithms: Storage and Recall Algorithm, BAM Energy Function, Proof of BAM Stability Theorem Architecture of Hopfield Network: Discrete and Continuous versions"] },
          { "name": "Unit- IV Classical & Fuzzy Sets", "topics": ["Classical & Fuzzy Sets: Introduction to classical sets - properties, Operations and relations; Fuzzy sets, Membership, Uncertainty, Operations, properties, fuzzy relations, cardinalities, membership functions."] },
          { "name": "Unit - V Logic System Components", "topics": ["Logic System Components: Fuzzification, Membership value assignment, development of rule base and decision-making system, Defuzzification to crisp sets, Defuzzification methods. Fuzzy logic applications"] }
        ]
      },
      {
        "code": "PE3206EC",
        "title": "Adaptive Filter Theory and Applications",
        "units": [
          { "name": "UNIT - I", "topics": ["Approaches to the development of adaptive filter theory. Introduction to filtering, smoothing and prediction. Wiener filter theory, introduction; Error performance surface; Normal equation; Principle of orthogonality; Minimum mean squared error; example."] },
          { "name": "UNIT - II Gradient algorithms", "topics": ["Gradient algorithms; Learning curves; LMS gradient algorithm; LMS stochastic gradient algorithms; convergence of LMS algorithms."] },
          { "name": "UNIT - III Applications", "topics": ["Applications of adaptive filter to adaptive noise cancelling, Echo cancellation in telephone circuits and adaptive beam forming."] },
          { "name": "UNIT - IV Kalman Filter theory", "topics": ["Kalman Filter theory; Introduction; recursive minimum mean square estimation for scalar random variables; statement of the kalman filtering problem: the innovations process; Estimation of state using the innovations process."] },
          { "name": "UNIT V Vector Kalman", "topics": ["Vector Kalman filter formulation. Examples. Application of kalman filter to target tracking."] }
        ]
      },
      {
        "code": "PE3207EC",
        "title": "Optical Communications",
        "units": [
          { "name": "UNIT -I Overview", "topics": ["Overview of Optical Fiber Communication: Introduction, Historical development, general system, advantages, disadvantages, and applications of optical fiber communication, optical fiber waveguides, basic optical laws, Ray theory, step index and graded index fibers, ray optics representation, fiber materials."] },
          { "name": "UNIT - II Transmission Characteristics", "topics": ["Transmission Characteristics of Optical Fibers: Introduction, Attenuation, absorption, scattering losses, bending loss, dispersion, Intra modal dispersion, Inter modal dispersion."] },
          { "name": "UNIT - III Sources and Detectors", "topics": ["Optical Sources and Detectors: Introduction, LED’s, LASER diodes, Photo detectors, Photo detector noise, Response time, double hetero junction structure, Photo diodes, comparison of photo detectors."] },
          { "name": "UNIT - IV Couplers and Connectors", "topics": ["Fiber Couplers and Connectors: Introduction, fiber alignment and joint loss, fiber splices, fiber connectors and fiber couplers. Optical Receiver: Introduction, Optical Receiver Operation, receiver sensitivity, quantum limit, eye diagrams, coherent detection."] },
          { "name": "UNIT –V Analog and Digital Links", "topics": ["Analog and Digital Links: Analog links – Introduction, overview of analog links, CNR, Digital links – Introduction, point–to–point links, System considerations, link power budget, resistive budget. WDM Concepts and Components: WDM concepts, overview of WDM operation principles, WDM standards,"] }
        ]
      }
    ]
  },
  {
    "code": "PE-III*",
    "title": "Professional Elective – III",
    "isGroup": true,
    "variants": [
      {
        "code": "PE3208EC",
        "title": "Information Theory and Coding",
        "units": [
          { "name": "UNIT - I Coding for Reliable Digital Transmission", "topics": ["Coding for Reliable Digital Transmission and storage:Mathematical model of Information, A Logarithmic Measure of Information, Average and Mutual Information and Entropy, Types of Errors, Error Control Strategies. Channel Coding Channel Capacity, binary symmetric channel, binary erasure channel, Shannon’s channel coding theorem, Huffman coding."] },
          { "name": "UNIT - II Linear Block Codes", "topics": ["Linear Block Codes:Introduction to Linear Block Codes, Syndrome and Error Detection, Minimum Distance of a block code, Error-detecting and Error-correcting Capabilities of a block code, Standard array and Syndrome Decoding, Probability of an undetected error for Linear Codes over a BSC, Hamming Codes. Applications of Block codes for Error control in data storage system"] },
          { "name": "UNIT - III Cyclic Codes", "topics": ["Cyclic Codes: Description, Generator and Parity-check Matrices, Encoding, Syndrome Computation and Error Detection, Decoding, Cyclic Hamming Codes, shortened cyclic codes, Error-trapping decoding for cyclic codes, Majority logic decoding for cyclic codes."] },
          { "name": "UNIT - IV Convolutional Codes", "topics": ["Convolutional Codes: Encoding of Convolutional Codes- Structural and Distance Properties, state, tree, trellis diagrams, maximum likelihood decoding, Sequential decoding, Majority- logic decoding of Convolution codes. Application of Viterbi Decoding and Sequential Decoding, Applications of Convolutional codes in ARQ system."] },
          { "name": "UNIT - V BCH Codes", "topics": ["BCH Codes: Minimum distance and BCH bounds, Decoding procedure for BCH codes, Syndrome computation and iterative algorithms, Error locations polynomials for single and double error correction."] }
        ]
      },
      {
        "code": "PE3209EC",
        "title": "Wireless Communications",
        "units": [
          { "name": "UNIT-I Intro", "topics": ["Overview of wireless communication system, History of wireless communication, current wireless systems, wireless spectrum, 2G, 3G, 4G and 5G wireless communication standards."] },
          { "name": "UNIT-II Modulation", "topics": ["Comparison of Digital Modulation schemes: Information Capacity, Bits, Bit Rate, Baud, and M-ARY Coding, ASK, FSK, PSK, QAM, BPSK, QPSK, 8PSK, 16PSK, 8QAM, 16QAM, DPSK, Band Width Efficiency."] },
          { "name": "UNIT-III The wireless communication environment", "topics": ["The wireless communication environment, classification of fading channels, different parameters related to fading mechanisms, modeling of wireless systems, system model for narrowband signals, Rayleigh fading wireless channel."] },
          { "name": "UNIT-IV CDMA", "topics": ["Basics mechanism of Code division multiple access (CDMA), fundamentals of CDMA codes, Introduction to MIMO wireless communication systems, MIMO system model, MIMO zero forcing and MMSE receiver."] },
          { "name": "UNIT-V OFDM", "topics": ["Multi carrier modulation, data transmission using multiple carriers, basics of orthogonal frequency division multiplexing (OFDM) systems, cyclic prefix, MIMO-OFDM system"] }
        ]
      },
      {
        "code": "PE3210EC",
        "title": "Radar Engineering",
        "units": [
          { "name": "UNIT-I Basics", "topics": ["Basics of Radar: Introduction, Maximum Unambiguous Range, Simple form of Radar Equation, Radar Block Diagram and Operation, Radar Frequencies and Applications, Prediction of Range Performance, Minimum Detectable Signal, Receiver Noise, Modified Radar Range Equation."] },
          { "name": "UNIT-II CW and Frequency Modulated Radar", "topics": ["CW and Frequency Modulated Radar: Doppler Effect, CW Radar – Block Diagram, Isolation between Transmitter and Receiver, Non-zero IF Receiver, Receiver Bandwidth Requirements, Applications of CW radar, Illustrative Problems.FM-CW Radar, Range and Doppler Measurement, Block Diagram and Characteristics (Approaching/ Receding Targets), FM-CW altimeter, Multiple Frequency CW Radar."] },
          { "name": "UNIT-III MTI and Pulse Doppler Radar", "topics": ["MTI and Pulse Doppler Radar: Introduction, Principle, MTI Radar with – Power Amplifier Transmitter and Power Oscillator Transmitter, Delay Line Cancellers – Filter Characteristics, Blind Speeds, Double Cancellation, And Staggered PRFs. Range Gated Doppler Filters, MTI Radar Parameters, Limitations to MTI Performance, MTI versus Pulse Doppler radar."] },
          { "name": "UNIT-IV Tracking Radar", "topics": ["Tracking Radar: Tracking with Radar, Sequential Lobing, Conical Scan, Monopulse Tracking Radar –Amplitude Comparison Monopulse (one- and two- coordinates), Phase Comparison Monopulse, Tracking in Range, Acquisition and Scanning Patterns, Comparison of Trackers."] },
          { "name": "UNIT-V Detection of Radar Signals in Noise", "topics": ["Detection of Radar Signals in Noise: Introduction, Matched Filter Receiver – Response Characteristics and Derivation, Correlation Function and Cross-correlation Receiver, Radar Receivers: Noise Figure and Noise Temperature, Displays – types. Duplexers – Branch type and Balanced type, Introduction to Phased Array Antennas."] }
        ]
      }
    ]
  },
  {
    "code": "OE-I#",
    "title": "Open Elective-I",
    "isGroup": true,
    "variants": [
      {
        "code": "OE3213EC",
        "title": "Microprocessors and Interfacing",
        "units": [
          { "name": "UNIT-I Intro", "topics": ["Evolution of microprocessors, 8085 microprocessor architecture, addressing modes and instruction sets.", "Basic assembly language programming, pin configuration, timing diagram of read and write operation."] },
          { "name": "UNIT-II 8086 Architecture", "topics": ["8086 architecture-functional block diagram, register organization, memory segmentation, programming model, pins description in maximum mode and minimum mode, timing diagrams."] },
          { "name": "UNIT-III Instruction Formats", "topics": ["Instruction formats, addressing modes, classification of instruction set, assembler directives, macros, 8086 microprocessor assembly language programs: simple programs involving data transfer operation, arithmetic operation, logical operation, branch operation, machine control operation, string manipulations, stack and subroutine operations."] },
          { "name": "UNIT-IV Peripherals", "topics": ["8255 Programmable peripheral interfaceblock diagram and various modes of operation. Interfacing of ADC, DAC, keyboard, seven segment display, stepper motor interfacing and 8254 (8253) programmable interval timers."] },
          { "name": "UNIT-V Interrupts", "topics": ["Interrupt structure of 8086, interfacing programmable interrupt controller 8259 and DMA Controller 8257 to 8086 microprocessor. Serial communication standards, RS 232,Serial data transfer schemes and block diagram of 8251 USART."] }
        ]
      },
      {
        "code": "OE3207CS",
        "title": "Fundamentals of Data Structures",
        "units": [
          { "name": "UNIT-I Intro", "topics": ["Introduction: Introduction to data structure, types of data structures, revision of arrays, memory representation of arrays, operations on arrays, static versus dynamic memory allocation, pointers, self-referential Structure Time complexity."] },
          { "name": "UNIT-II Stack & Queue", "topics": ["Stack-Queue (Linear Data structures): Definition of stack, operations on stack, implementation of stack. Applications of Stack."] },
          { "name": "UNIT-III Lists", "topics": ["Definition of queue, operations on queue, implementation of queue using arrays. Applications of queue, Circular queue and priority queue."] },
          { "name": "UNIT-IV Trees & Graphs", "topics": ["Trees-Graphs (Nonlinear Data structures): definition of trees, Terminology on trees, binary tree, binary search tree and its operations, tree traversal techniques. Applications of Trees."] },
          { "name": "UNIT-V Sorting", "topics": ["Graph: definition, terminology on graphs, representation of graphs, graph traversal techniques, spanning tree, minimum spanning tree algorithms. Applications of Graphs."] }
        ]
      }
    ]
  },
  {
    "code": "PC3214EC",
    "title": "Digital Signal Processing Laboratory",
    "units": [
      { "name": "List of Experiments", "topics": ["1. (a)Generation of basic signals based on recursive difference equations. (b) Operations on Basic sequences", "2. (a) Linear and Circular Convolutions in time domain and frequency domain (b) Determination of autocorrelation and Power Spectrum of a given signal(s)", "3. (a) Fast Fourier Transform – DIT and DIF algorithm (b) Spectrum analysis using DFT", "4. (a) Generation of windows – Rectangular, Hamming and Hamming window (b) Design of LPF, HPF, BPF and BSF using windowing technique", "5. (a) Design of Butterworth Filter using Impulse Invariant and Bilinear transformation (b) Design of Chebyshev Filter using Impulse Invariant and Bilinear transformation", "6. (a) Implementation of Decimation and Interpolation Process. (b) Implementation of I/D sampling rate converters.", "7. (a) Study of TMS320C54X DSP processor (b) Arithmetic operation using TMS320C54XX", "8. MAC operation using various addressing modes", "9. (a) Linear Convolution (b) Circular Convolution", "10. (a) FFT Implementation (b) Waveform Generation – Sine wave and Square wave", "11. Implementation of FIR filter on DSP processor", "12. Implementation of IIR filter on DSP processor"] }
    ]
  },
  {
    "code": "PC3215EC",
    "title": "Electronic Design and Automation Laboratory",
    "units": [
      { "name": "List of Experiments", "topics": ["Part A (Digital VLSI front-end Design): Develop Verilog HDL code and Test bench for: Multiplexer, Decoder, Encoder, Parity Generator, D flip-flop, four-bit adder, magnitude comparator; Four-bit parallel adder/subtractor, zero/one detector and JK flip-flop; Asynchronous, Synchronous, Ring and Johnson counters; Sequence Detector using Mealy and Moore type state machines. Develop VERILOG HDL code for eight to three priority encoders. Develop VERILOG HDL code for a four-bit carry look-ahead adder. Develop VERILOG HDL code for a sixteen decoder. Using conditional operator, write Verilog HDL code to shift input data. Write Verilog HDL code to realize all bit Zero/One detector. Develop Verilog HDL code to realize a MOD-10 synchronous decimal up counter. Develop VERILOG HDL code for the state machine of control unit of GCD processor. Develop VERILOG HDL code to realize a four-bit universal shift register. Develop VERILOG HDL code to realize a four-bit ring counter. Develop VERILOG HDL code to realize a four-bit twisted ring counter. Design a clock generator. Design four-bit binary to Gray converter and Gray to binary converter. Acquaint with Synthesis and FPGA porting of the code.", "Part B (Digital VLSI back-end Design): Design and analyze the following CMOS circuits: Inverter using static, ratioed, dynamic and domino logic styles; Two-input NAND gate; Two-input NOR gate; Two-to-one Multiplexer using transmission gate; Design a one-bit full adder circuit; Design a one-bit SRAM cell. Draw the layout and evaluate the performance of CMOS Inverter and two-input CMOS NAND gate."] }
    ]
  }
];

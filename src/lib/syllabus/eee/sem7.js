export const semester7 = [
    {
      "code": "PC-4101EE",
      "title": "Power System Analysis",
      "units": [
        { "name": "UNIT-I NETWORK TOPOLOGY", "topics": ["NETWORK TOPOLOGY: Introduction, Elementary graph theory – oriented graph, tree, co-tree, basic cut-sets, basic loops; Incidence matrices – Element-node, Bus incidence, Branch-path incidence matrix, Basic cut-set, Augmented cut-set, Basic loop and Augmented loop; Primitive network – impedance form and admittance form."] },
        { "name": "UNIT – II NETWORK MATRICES", "topics": ["NETWORK MATRICES: Introduction, Formation of YBUS matrix– by method of inspection (including transformer off-nominal tap setting), by method of singular transformation; Formation of Bus Impedance Matrix by step by step building algorithm"] },
        { "name": "UNIT - III LOAD FLOW STUDIES", "topics": ["LOAD FLOW STUDIES: Introduction, Power flow equations, Classification of buses, Operating constraints, Data for load flow; Gauss-Seidal Method – Algorithm and flow chart for PQ and PV buses (numerical problem for one iteration only), Acceleration of convergence; Newton Raphson Method – Algorithm and flow chart for NR method in polar coordinates (numerical problem for one iteration only); Algorithm for Fast Decoupled load flow method; Comparison of Load Flow Methods."] },
        { "name": "UNIT-IV SHORT CIRCUIT ANALYSIS", "topics": ["SHORT CIRCUIT ANALYSIS: Assumptions in short circuit analysis — Symmetrical short circuit analysis using Thevenin’s theorem — Bus Impedance matrix building algorithm (without mutual coupling) — Symmetrical fault analysis through bus impedance matrix — Post fault bus voltages Symmetrical components — Sequence impedances and networks — Analysis of unsymmetrical faults at generator terminals: LG, LL and LLG — Unsymmetrical Fault Analysis: Fault current calculations for LG, LL, LLG faults with and without fault impedance, Numerical Problems"] },
        { "name": "UNIT –V TRANSIENT STABILITY STUDIES", "topics": ["TRANSIENT STABILITY STUDIES: Numerical solution of Swing Equation – Point-by-point method, Modified Euler‘s method, Runge-Kutta method, Milne‘s predictor corrector method. Representation of power system for transient stability studies – load representation, network performance equations. Solution techniques with flow charts."] }
      ]
    },
    {
      "code": "PE-III",
      "title": "Professional Elective-III",
      "isGroup": true,
      "variants": [
        {
          "code": "PE-4102EE",
          "title": "Flexible AC Transmission Systems",
          "units": [
            { "name": "UNIT – I FACTS Concepts", "topics": ["FACTS Concepts: Transmission interconnections power flow in an AC system, loading capability limits, Dynamic stability considerations, importance of controllable parameters, basic types of FACTS controllers, and benefits from FACTS controllers."] },
            { "name": "UNIT – II Static Shunt Compensation", "topics": ["Static Shunt Compensation: Objectives of shunt compensation, midpoint voltage regulation, voltage instability prevention, improvement of transient stability, Power oscillation damping, Methods of controllable var generation, variable impedance type static var generators, switching converter type var generators and hybrid var generators."] },
            { "name": "UNIT – III SVC and STATCOM", "topics": ["SVC and STATCOM: SVC: FC-TCR and TSC-TCR. STATCOM: The regulation and slope, var reserve control. Comparison between SVC and STATCOM"] },
            { "name": "UNIT – IV Static Series Compensators", "topics": ["Static Series Compensators: Objectives of Series compensation, concept of series capacitive compensation, GTO thyristor-controlled series capacitor (GCSC), thyristor switched series capacitor (TSSC), thyristor-controlled series capacitor (TCSC) control schemes for GCSC TSSC and TCSC, and operation of SSSC"] },
            { "name": "UNIT – V Advanced Facts Controllers", "topics": ["Advanced Facts Controllers: Unified Power flow controller (UPFC) - Interline power flow controller (IPFC) - Unified Power quality conditioner (UPQC)."] }
          ]
        },
        {
          "code": "PE-4103EE",
          "title": "Industrial Electrical Systems",
          "units": [
            { "name": "UNIT-I ELECTRICAL SYSTEM COMPONENTS", "topics": ["ELECTRICAL SYSTEM COMPONENTS: LT system wiring components, selection of cables, wires, switches, distribution box, metering system, Tariff structure, selection of components for Industrial systems- Fuse, MCB, MCCB, ELCB, characteristic, symbols, single line diagram (SLD) of a wiring system, Contactor, Isolator, Relays, MPCB, Electric shock and Electrical safety practices"] },
            { "name": "UNIT-II RESIDENTIAL AND COMMERCIAL ELECTRICAL SYSTEMS", "topics": ["RESIDENTIAL AND COMMERCIAL ELECTRICAL SYSTEMS: Types of residential and commercial wiring systems, general rules and guidelines for installation, load calculation and sizing of wire, rating of main switch, distribution board and protection devices, earthing system calculations, requirements of commercial installation, deciding lighting scheme and number of lamps, earthing of commercial installation, selection and sizing of components."] },
            { "name": "UNIT-III ILLUMINATION SYSTEMS", "topics": ["ILLUMINATION SYSTEMS: Understanding various terms regarding light, lumen, intensity, candle power, lamp efficiency, specific consumption, glare, space to height ratio, waste light factor, depreciation factor, various illumination schemes, Incandescent lamps and modern luminaries like CFL, LED and their operation, energy saving in illumination systems, design of a lighting scheme for a residential and commercial premises, flood lighting."] },
            { "name": "UNIT-IV INDUSTRIAL ELECTRICAL SYSTEMS I", "topics": ["INDUSTRIAL ELECTRICAL SYSTEMS I: HT connect ion, industrial substation, Transformer select ion, Industrial loads, motors, starting of motors, SLD, Cable and Switchgear selection, Lightning Protection, Earthing design, Power factor correction – kVAR calculations, type of compensation, Introduction to PCC, MCC panels. Specifications of LT Breakers, MCB and other LT panel components."] },
            { "name": "UNIT-V INDUSTRIAL ELECTRICAL SYSTEMS II", "topics": ["INDUSTRIAL ELECTRICAL SYSTEMS II: DG Systems, UPS System, Electrical Systems for the elevators, Battery banks, Sizing the DG, UPS and Battery Banks, Selection of UPS and Battery Banks."] }
          ]
        },
        {
          "code": "PE-4104EE",
          "title": "Power System Reliability",
          "units": [
            { "name": "UNIT-I BASIC PROBABILITY THEORY", "topics": ["BASIC PROBABILITY THEORY: Elements of probability, probability distributions, Random variables, Density and Distribution functions- Binomial distribution- Expected value and standard deviation - Binomial distribution, Poisson distribution, normal distribution, exponential distribution, Weibull distribution. DEFINITION OF RELIABILITY: Definition of terms used in reliability, Component reliability, Hazard rate, derivation of the reliability function in terms of the hazard rate. Hazard models - Bath tub curve, Effect of preventive maintenance. Measures of reliability: Mean Time to Failure and Mean Time between Failures."] },
            { "name": "UNIT-II GENERATING SYSTEM RELIABILITY ANALYSIS", "topics": ["GENERATING SYSTEM RELIABILITY ANALYSIS: Generation system model – capacity outage probability tables – Recursive relation for capacitive model building – sequential addition method – unit removal – Evaluation of loss of load and energy indices – Examples. Frequency and Duration methods – Evaluation of equivalent transitional rates of identical and non-identical units – Evaluation of cumulative probability and cumulative frequency of non-identical generating units – 2-level daily load representation - merging generation and load models – Examples."] },
            { "name": "UNIT-III OPERATING RESERVE EVALUATION", "topics": ["OPERATING RESERVE EVALUATION: Basic concepts - risk indices – PJM methods – security function approach – rapid start and hot reserve units – Modeling using STPM approach.", "BULK POWER SYSTEM RELIABILITY EVALUATION: Basic configuration – conditional probability approach – system and load point reliability indices – weather effects on transmission lines – Weighted average rate and Markov model – Common mode failures."] },
            { "name": "UNIT-IV INTER CONNECTED SYSTEM RELIABILITY ANALYSIS", "topics": ["INTER CONNECTED SYSTEM RELIABILITY ANALYSIS: Probability array method – Two inter connected systems with independent loads – effects of limited and unlimited tie capacity - imperfect tie – Two connected Systems with correlated loads – Expression for cumulative probability and cumulative frequency."] },
            { "name": "UNIT-V DISTRIBUTION SYSTEM RELIABILITY ANALYSIS & SUBSTATIONS", "topics": ["DISTRIBUTION SYSTEM RELIABILITY ANALYSIS: Basic Techniques – Radial networks –Evaluation of Basic reliability indices, performance indices – load point and system reliability indices – customer oriented, loss and energy-oriented indices – Examples. Basic concepts of parallel distribution system reliability.", "SUBSTATIONS AND SWITCHING STATIONS: Effects of short-circuits - breaker operation – Open and Short-circuit failures – Active and Passive failures – switching after faults – circuit breaker model – preventive maintenance – exponential maintenance times."] }
          ]
        }
      ]
    },
    {
      "code": "PE-IV",
      "title": "Professional Elective-IV",
      "isGroup": true,
      "variants": [
        {
          "code": "PE-4105EE",
          "title": "Digital Control System",
          "units": [
            { "name": "UNIT-I DISCRETE REPRESENTATION OF CONTINUOUS SYSTEMS", "topics": ["DISCRETE REPRESENTATION OF CONTINUOUS SYSTEMS: Basics of Digital Control Systems. Discrete representation of continuous systems. Sample and hold circuit. Mathematical Modeling of sample and hold circuit. Effects of Sampling and Quantization. Choice of sampling frequency. ZOH equivalent."] },
            { "name": "UNIT-II DISCRETE SYSTEM ANALYSIS", "topics": ["DISCRETE SYSTEM ANALYSIS: Z-Transform and Inverse Z Transform for analyzing discrete time systems. Pulse Transfer function. Pulse transfer function of closed loop systems. Mapping from s-plane to z plane. Solution of Discrete time systems. Time response of discrete time system.", "STABILITY OF DISCRETE TIME SYSTEM: Stability analysis by Jury test. Stability analysis using bilinear transformation. Design of digital control system with dead beat response. Practical issues with dead beat response design."] },
            { "name": "UNIT-III STATE SPACE APPROACH FOR DISCRETE TIME SYSTEMS", "topics": ["STATE SPACE APPROACH FOR DISCRETE TIME SYSTEMS: State space models of discrete systems, state space analysis. Lyapunov Stability. Controllability, reach- ability, Reconstructibility and observability analysis. Effect of pole zero cancellation on the controllability &observability."] },
            { "name": "UNIT-IV DESIGN OF DIGITAL CONTROL SYSTEM", "topics": ["DESIGN OF DIGITAL CONTROL SYSTEM: Design of Discrete PID Controller, Design of discrete state feedback controller. Design of set point tracker. Design of Discrete Observer for LTI System. Design of Discrete compensator."] },
            { "name": "UNIT-V DISCRETE OUTPUT FEEDBACK CONTROL", "topics": ["DISCRETE OUTPUT FEEDBACK CONTROL: Design of discrete output feedback control. Fast output sampling (FOS) and periodic output feedback controller design for discrete time systems."] }
          ]
        },
        {
          "code": "PE-4106EE",
          "title": "HVDC Transmission System",
          "units": [
            { "name": "UNIT-I BASIC CONCEPTS", "topics": ["BASIC CONCEPTS: Necessity of HVDC systems, Economics and Terminal equipment of HVDC transmission systems, Types of HVDC Links, Apparatus required for HVDC Systems, Comparison of AC and DC Transmission, Application of DC Transmission System, Planning and Modern trends in D.C. Transmission.", "ANALYSIS OF HVDC CONVERTERS: Choice of Converter Configuration, Analysis of Graetz circuit, Characteristics of 6 Pulse and 12 Pulse converters, Cases of two 3 phase converters in Y/Y mode-their performance."] },
            { "name": "UNIT-II CONVERTER AND HVDC SYSTEM CONTROL", "topics": ["CONVERTER AND HVDC SYSTEM CONTROL: Principle of DC Link Control, Converters Control Characteristics, Firing angle control, Current and extinction angle control, Effect of source inductance on the system, Starting and stopping of DC link, Power Control.", "REACTIVE POWER CONTROL IN HVDC: Introduction, Reactive Power Requirements in steady state, sources of reactive power-Static VAR Compensators, Reactive power control during transients."] },
            { "name": "UNIT-III POWER FLOW ANALYSIS IN AC/DC SYSTEMS", "topics": ["POWER FLOW ANALYSIS IN AC/DC SYSTEMS: Modelling of DC Links, DC Network, DC Converter, Controller Equations, Solution of DC load flow. System for DC quantities, solution of AC-DC Power flow-Simultaneous method- Sequential method."] },
            { "name": "UNIT-IV CONVERTER FAULTS AND PROTECTION", "topics": ["CONVERTER FAULTS AND PROTECTION: Converter faults, protection against over current and over voltage in converter station, surge arresters, smoothing reactors, DC breakers, Audible noise, space charge field, corona effects on DC lines, Radio interference."] },
            { "name": "UNIT-V HARMONICS", "topics": ["HARMONICS: Generation of Harmonics, Characteristics harmonics, calculation of AC Harmonics, Non- Characteristics harmonics, adverse effects of harmonics, Calculation of voltage and Current harmonics, Effect of Pulse number on harmonics", "FILTERS: Types of AC filters, Design of Single tuned filters –Design of High pass filters."] }
          ]
        },
        {
          "code": "PE-4107EE",
          "title": "Power Quality Engineering",
          "units": [
            { "name": "UNIT – I Introduction", "topics": ["Introduction: Introduction of the Power Quality (PQ) problem, Terms used in PQ: Voltage, Sag, Swell, Surges, Harmonics, over voltages, spikes, Voltage fluctuations, Transients, Interruption, overview of power quality phenomenon, Remedies to improve power quality, power quality monitoring."] },
            { "name": "UNIT – II Long & Short Interruptions", "topics": ["Long & Short Interruptions: Interruptions – Definition – Difference between failures, outage, Interruptions – causes of Long Interruptions – Origin of Interruptions – Limits for the Interruption frequency – Limits for the interruption duration – costs of Interruption – Overview of Reliability evaluation to power quality, comparison of observations and reliability evaluation.", "Short interruptions: definition, origin of short interruptions, basic principle, fuse saving, voltage magnitude events due to re-closing, voltage during the interruption, monitoring of short interruptions, difference between medium and low voltage systems. Multiple events, single phase tripping – voltage and current during fault period, voltage and current at post fault period, stochastic prediction of short interruptions."] },
            { "name": "UNIT – III Single and Three Phase Voltage Sag Characterization", "topics": ["Single and Three Phase Voltage Sag Characterization: Voltage sag – definition, causes of voltage sag, voltage sag magnitude, and monitoring, voltage sag calculation in non-radial systems, meshed systems, and voltage sag duration. Three phase faults, phase angle jumps, magnitude and phase angle jump for three phase unbalanced sags, load influence on voltage sags."] },
            { "name": "UNIT – IV Power Quality Considerations in Industrial Power Systems", "topics": ["Power Quality Considerations in Industrial Power Systems: Voltage sag – equipment behaviour of Power electronic loads, induction motors, synchronous motors, computers, consumer electronics, adjustable speed AC drives and its operation. Mitigation of AC Drives, adjustable speed DC drives and its operation, mitigation methods of DC drives."] },
            { "name": "UNIT – V Mitigation of Interruptions & Voltage Sags", "topics": ["Mitigation of Interruptions & Voltage Sags: Overview of mitigation methods – from fault to trip, reducing the number of faults, reducing the fault clearing time changing the power system, installing mitigation equipment, improving equipment immunity, different events and mitigation methods. System equipment interface – voltage source converter, series voltage controller, shunt controller, combined shunt and series controller."] }
          ]
        }
      ]
    },
    {
      "code": "OE-II",
      "title": "Open Elective-II",
      "isGroup": true,
      "variants": [
        {
          "code": "OEII4108HS",
          "title": "Disaster Management",
          "units": [
            { "name": "UNIT – I", "topics": ["Introduction & Principles of Disaster Management: Nature - development, hazards and disasters; natural disasters - earth quakes, floods, fire, landslides, cyclones, tsunamis, nuclear; chemical dimensions and typology of disasters - public health disasters, national policy on disaster management"] },
            { "name": "UNIT –II", "topics": ["Prevention Preparedness and Mitigation Measures: Prevention, preparedness & mitigation measures for various disasters, post disaster reliefs and logistics management, emergency support functions and their coordination mechanism, resources and material management, management of relief camp"] },
            { "name": "UNIT– III", "topics": ["Risk and Vulnerability: Building codes and land use planning, social vulnerability, environmental vulnerability, macroeconomic management and sustainable development, climate change, risk rendition, financial management of disaster and related losses"] },
            { "name": "UNIT - IV", "topics": ["Role of Technology in Disaster Management: Disaster management for infrastructures, taxonomy of infrastructure, treatment plants and storage facilities, roads and bridges, geo spatial information in agriculture, drought assessment, multimedia technology in disaster risk management and training"] },
            { "name": "UNIT-V", "topics": ["Disaster management in India: Disaster Profile of India – Mega Disasters of India and Lessons Learnt Disaster Management Act 2005 – Institutional and Financial Mechanism National Policy on Disaster Management, National Guidelines and Plans on Disaster Management;"] }
          ]
        },
        {
          "code": "OEII4109EE",
          "title": "Non-Conventional Energy Sources",
          "units": [
            { "name": "UNIT-I", "topics": ["Review of Conventional and Non-Conventional energy sources - Need for non-conventional energy sources - Fuel Cells - Principle of operation with special reference to H2O2 Cell - Classification and Block diagram of fuel cell systems - Ion exchange membrane cell - Molten carbonate cells - Solid oxide electrolyte cells - Regenerative system- Regenerative Fuel Cell - Advantages and disadvantages of Fuel Cells-Polarization - Conversion efficiency and Applications of Fuel Cells."] },
            { "name": "UNIT-II", "topics": ["Solar energy - Solar radiation and its measurements - Solar Energy collectors -Solar Energy storage systems - Solar Pond - Application of Solar Pond - Applications of solar energy."] },
            { "name": "UNIT-III", "topics": ["Wind energy- Principles of wind energy conversion systems - Nature of wind - Power in the Wind- Basic components of WECS -Classification of WECS -Site selection considerations -Advantages and disadvantages of WECS -Wind energy collectors -Wind electric generating and control systems - Applications of Wind energy -Environmental aspects."] },
            { "name": "UNIT- IV", "topics": ["Energy from the Oceans - Ocean Thermal Electric Conversion (OTEC) methods - Principles of tidal power generation -Advantages and limitations of tidal power generation -Ocean waves - Wave energy conversion devices -Advantages and disadvantages of wave energy - Geo-Thermal Energy - Types of Geo-Thermal Energy Systems - Applications of Geo-Thermal Energy."] },
            { "name": "UNIT-V", "topics": ["Energy from Biomass - Biomass conversion technologies / processes - Photosynthesis - Photosynthetic efficiency - Biogas generation - Selection of site for Biogas plant - Classification of Biogas plants - Details of commonly used Biogas plants in India - Advantages and disadvantages of Biogas generation -Thermal gasification of biomass -Biomass gasifiers."] }
          ]
        },
        {
          "code": "OEII4110HS",
          "title": "Startup Enterprenurship",
          "units": [
            { "name": "UNIT – I", "topics": ["Creativity & Discovery: Definition of Creativity, self-test creativity, discovery and delivery skills, The imagination threshold, Building creativity ladder, Collection of wild ideas, Bench marking the ideas, Innovative to borrow or adopt, choosing the best of many ideas, management of tradeoff between discovery and delivery"] },
            { "name": "UNIT – II", "topics": ["From Idea to Startup: Introduction to think ahead backward, Validation of ideas using cost and strategy, visualizing the business through value profile, activity mapping, Risks as opportunities, building your own road map"] },
            { "name": "UNIT – III", "topics": ["Innovation career lessons: Growing & Sharing Knowledge, The Role of Failure In Achieving Success, Creating vision, Strategy, Action & Resistance: Differentiated Market Transforming Strategy; Dare to Take Action; Fighting Resistance; All About the startup Ecosystem; Building a Team; Keeping it Simple and Working Hard."] },
            { "name": "UNIT – IV", "topics": ["Action driven business plan: Creating a completed non-business plan, including a list of the activities to be undertaken, with degrees of importance. A revision of the original product or service idea, in light of information gathered in the process, beginning to design the business or organization that will successfully implement your creative idea."] },
            { "name": "UNIT – V", "topics": ["Startup financing cycle: Preparing an initial cash flow statement, showing money flowing out and flowing in. Estimate your capital needs realistically. Prepare a bootstrapping option (self-financing). Prepare a risk map. Prepare a business plan."] }
          ]
        }
      ]
    },
    {
      "code": "PC-4112EE",
      "title": "Power Systems Laboratory",
      "units": [
        { "name": "List of Experiments", "topics": ["1. Performance characteristics of 3-phase transmission line model", "2. Determination A B C D parameters of 3-phase transmission line model", "3. IDMT Characteristics of an over current (Electromagnetic) Relay", "4. Differential protection of single-phase transformer", "5. Determination of positive, negative, zero sequence impedances of 3-phase transformers.", "6. Determination of positive, negative, zero sequence impedances of 3-phase Alternator.", "7. Transient Stability analysis using MATLAB Simulink", "8. Fault analysis on an un-loaded 3-phase Alternator.", "9. Load Frequency control of single area system using MATLAB Simulink.", "10. Load Frequency control of two area system using MATLAB Simulink.", "11. Formation of Y BUS.", "12. Load Flow Analysis using Gauss Seidal (GS)Method.", "13. Load Flow Analysis using Fast Decoupled (FD)Method.", "14. Formation ofZ BUS.", "15. Simulation of Compensated Line", "16. Operating characteristics of Directional Over Current Relay"] }
      ]
    },
    {
      "code": "PC-4113EE",
      "title": "Power Electronics and Drives Laboratory",
      "units": [
        { "name": "List of Experiments", "topics": ["1. Study of Characteristics of SCR, MOSFET &IGBT,", "2. Single Phase AC Voltage Controller with R and RLLoads", "3. Single Phase half controlled &fully controlled bridge converter with R and RLLoads", "4. Forced Commutation circuits (Class A, Class B, Class C, Class D & ClassE)", "5. Single Phase Cyclo-converter with R and RLLoads", "6. Single Phase Bridge inverter with R and RLLoads", "7. Simulation of 1-phase fully-controlled and half-controlled rectifier fed separately excited DC motor", "8. Simulation of open loop or closed loop speed control of 3-phase induction motor using V/f control and using sine PWM", "9. DC Jones chopper with R and RLLoads", "10. Three Phase half controlled bridge converter withR-load", "11. Single Phase dual converter with RLLoads", "12. (a)Simulation of single-phase Half wave converter using R and RL loads (b)Simulation of single-phase full converter using R, RL and RLE loads (c)Simulation of single-phase Semi converter using R, RL and RLE loads", "13. (a)Simulation of Single-phase AC voltage controller using R and RL loads (b)Simulation of Single phase Cyclo-converter with R andRL-loads", "14. Simulation of Buck chopper", "15. Simulation of single phase Inverter with PWMcontrol", "16. Simulation of three phase fully controlled converter with R and RL loads, with and without freewheeling diode. Observation of waveforms for Continuous and Discontinuous modes of operation.", "17. Simulation of closed loop speed control of DC motor with different control schemes (PID, hysteresis current control, Fuzzy, ANFIS etc)", "18. Design and simulation of buck, boost and buck-boost converters", "19. Simulation of Dual Converter – 4 quadrant operation – separately excited DC motor", "20. Simulation of Regenerative Braking – Bidirectional Power Transfer", "21. Simulation of Switched Mode Rectifiers – keeping load voltage constant irrespective of line and load variations – closed loop circuit simulation"] }
      ]
    }
  ];

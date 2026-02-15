export const semester5 = [
  {
    "code": "PC3101IT",
    "title": "Database Management Systems",
    "units": [
      { "name": "UNIT – I Intro & Data Modeling", "topics": ["Introduction to Database System and its Applications: Evolution of DBMS, File Systems versus a DBMS, Data Models, Levels of Abstraction in a DBMS, Data Independence, Structure of a DBMS.", "Data modeling: Introduction to ER model, Naming, conventions, Entities, Attributes, and Entity Sets, Relationships and Relationship Types, Constraints."] },
      { "name": "UNIT – II Relational Model", "topics": ["Relational Model: Introduction, constraints over relations, integrity constraints, Querying relational data, and logical data base design, introduction to views, Relational Algebra, Tuple relational Calculus, Domain relational calculus."] },
      { "name": "UNIT – III SQL & Design Refinement", "topics": ["SQL: Introduction, Syntax, Basic commands, Specifying constraints, Basic Queries, Nested Quires, Queries using different Clauses, Cursors, Triggers, Built-in SQL functions.", "Database Design refinement: Informal Design guidelines, Issues of redundancy, null values and decomposition, functional dependencies, FIRST, SECOND, THIRD normal forms, BCNF, lossless join, multi-valued dependencies, FOURTH normal form, FIFTH normal form."] },
      { "name": "UNIT – IV Transaction Processing", "topics": ["Transaction Processing: Introduction, Transaction State and desirable properties, Transaction schedules, Serializability, and Recoverability.", "Concurrency control Techniques: Introduction, locking techniques and Timestamp Based Protocols.", "Database Recovery techniques: Recovery Techniques based on deferred update, Recovery Techniques based on immediate update. Shadow Paging."] },
      { "name": "UNIT – V Storage and Indexing", "topics": ["Data Storage and indexing: File Organization and Indexing, Cluster Indexes, Primary and Secondary Indexes, Index data Structures, Hash Based Indexing, Tree base Indexing, Comparison of File Organizations."] }
    ]
  },
  {
    "code": "PC3102IT",
    "title": "Theory of Computation",
    "units": [
      { "name": "UNIT – I Finite Automata", "topics": ["Introduction and Finite Automata: Alphabets, Strings, Languages, Definition and applications of Finite Automata (FA), acceptance of strings and languages, Deterministic Finite Automata (DFA) and its representation, Non Deterministic Finite Automata (NFA), transition diagrams and Language recognizers. Conversions and Equivalence of NFA and DFA, NFA with ε- transitions and its conversion to NFA without ε- transitions, Minimization of Automata, Equivalence between two Automata’s."] },
      { "name": "UNIT – II Regular Expressions & Finite Automata", "topics": ["Finite Automat with output and Regular Expressions: Finite Automata with output- Moore and Mealy machines and its equivalence. Definition of Regular expression(RE), Algebraic laws for Regular Expressions, Applications of REs, Regular sets, Regular languages, Designing of Finite Automata for Regular expression, DFA to Regular expression, Arden’s Theorem, Non Regular Languages, Pumping Lemma for Regular Language, Applications of Pumping lemma, Closure properties of Regular languages."] },
      { "name": "UNIT – III Grammars", "topics": ["Regular Grammar, Context Free Grammars and Languages: Formal definition of Grammar, Regular Grammar, Right linear and left linear grammars, Equivalence between regular grammars and Finite Automata, Chomsky Hierarchy of Grammar Context Free Grammar (CFG), Leftmost, Rightmost derivations, Ambiguity in grammars and languages. Designing of grammar for regular language, Simplification of Context Free Grammars, Closure Properties of CFL."] },
      { "name": "UNIT – IV Pushdown Automata", "topics": ["Normal forms and Pushdown Automata: Definition of Normal Form, Chomsky Normal Form (CNF), Greiback normal form (GNF), Conversion of CFG to CNF and GNF.", "Pushdown Automata: Definition of Push Down Automata( PDA) , Representation and Acceptance of PDA, Designing PDA, Equivalence of CFG and PDA, Pumping Lemma for Context Free Languages."] },
      { "name": "UNIT – V Turing Machines", "topics": ["Context sensitive Languages and Turing Machine: Definition of Linear Bounded Automata and its Representation, Introduction to Turing Machines(TM), Definition and Representation of TM, Variations of TM: Multitape TMs, Non Deterministic TM, Universal TM, Designing of TM.", "Undesirability and Recursively enumerable languages: Recursive and Recursively enumerable languages, Definition of Undecidable Problem, Halting Problem, Post’s Correspondence Problem (PCP)."] }
    ]
  },
  {
    "code": "ES3103IT",
    "title": "Principles of Signals and Systems",
    "units": [
      { "name": "UNIT-I Introduction", "topics": ["Introduction to Signals & Systems: Classification of signals, Operations on signals, types of systems, Exponential and Trigonometric Fourier series, Dirichlet’s condition."] },
      { "name": "UNIT-II Fourier Transform", "topics": ["Fourier Transform: Representation of aperiodic signal, Introduction of Fourier transform, Convergence, properties of Fourier Transform, Fourier transform of periodic signals, Singularity function, Parseval’s theorem, Energy spectral density, Development of Discrete Time Fourier transform, Convergence issues associated with the DTFT."] },
      { "name": "UNIT-III Sampling & Convolution", "topics": ["Sampling: Sampling of continuous time signals, sampling theorem, Aliasing effect, reconstruction of a signal and its samples.", "Convolution & Correlation of signals: Convolution integral, properties of convolution, Graphical method of convolution, Convolution of Discrete time signals, overlap-add and overlap-save method of discrete convolution, Definition of correlation, Auto correlation, Properties of Autocorrelation, Cross correlation of signals."] },
      { "name": "UNIT-IV Laplace Transform", "topics": ["Laplace Transform: Review of Laplace transforms, region of convergence and properties, poles and zeros, relation between Laplace and Fourier transforms, properties of Laplace transform, inverse Laplace transform, Solutions to differential equation and system behavior."] },
      { "name": "UNIT-V Z Transform", "topics": ["Z Transform: Definition of Z-Transform, Properties of Z-Transform, Region of convergence of Z-Transform, Inverse Z Transform using Inspection, Partial fraction expansion, Power series Expansion, Contour integration methods, Parseval’s relation analysis of discrete time systems using Z-Transform. Realization of discrete time system using Direct form, Cascade parallel forms."] }
    ]
  },
  {
    "code": "PE-I*",
    "title": "Professional Elective – I",
    "isGroup": true,
    "variants": [
      {
        "code": "PE3104IT",
        "title": "Web Programming",
        "units": [
          { "name": "UNIT – I Web Basics & HTML", "topics": ["Web Basics: Introduction, Concept of Internet- Protocols of Internet, World Wide Web, URL, Web Server, Web Browser.", "HTML: Introduction, History of HTML, Structure of HTML Document: Text Basics, Images and Multimedia, Links and webs, Document Layout, Cascading Style Sheet- HTML 4 style sheet features, Creating Forms, Frames and Tables."] },
          { "name": "UNIT – II DHTML, XML & JavaScript", "topics": ["Dynamic HTML: Introduction of DHTML- HTML vs. DHTML, Advantages of DHTML, CSS of DHTML, Event Handling, Data Binding, Browser Object Models.", "XML Introduction: Introduction of XML- Some current applications of XML, Features of XML, Anatomy of XML document, The XML Declaration, Element Tags Nesting and structure, XML text and text formatting element, Table element, Mark-up Element and Attributes, Document Type Definition (DTD), types. XML Schema, Importance of XML schema, Creating Element in XML Schema, XML Schema Types.", "Introduction of Java Script: JavaScript characteristics, Objects in Java Script, Dynamic HTML with Java Script."] },
          { "name": "UNIT – III AJAX", "topics": ["AJAX Introduction: Introduction, AJAX Introduction, AJAX Components, Handling Dynamic HTML with AJAX, CSS to Define Look and Feel, Understand the XML Mark-up, XMLHttpRequest.", "AJAX using XML and XML HttpRequest: Introduction, AJAX Using XML and XMLHttpRequest, Accessing, Creating and Modifying XML Nodes, Loading XML Data into an HTML Page, Receiving XML Responses, Handling Response XML."] },
          { "name": "UNIT – IV PHP", "topics": ["PHP Introduction: PHP Introduction, Structure of PHP, PHP Functions, AJAX with PHP, PHP Code and the Complete AJAX Example.", "AJAX with Database: Introduction, AJAX Database, Working of AJAX with PHP, AJAX PHP Database Form, AJAX PHP MySQL Select Query."] },
          { "name": "UNIT – V ASP", "topics": ["Active Server Page: Introduction, Introduction of ASP, ASP – Variables, ASP Control Structure, ASP Objects’ Properties and Methods.", "ASP Database Connectivity: Introduction, ASP Components, ASP Database Connection, ASP Scripting Components."] }
        ]
      },
      {
        "code": "PE3105IT",
        "title": "Advanced Java",
        "units": [
          { "name": "UNIT – I Swings & JavaFX", "topics": ["Swings, JavaFX and Event Handling: Swing: Introduction to swings, Comparison with AWT, Exploring Swing Components: JTextField, Jlabel, Swing buttons, JPasswordField, JTable, JComboBox, JList, JTree, JColorChooser, Dialogs and Swing Menus.", "Event Handling: The Delegation event model- Events, Event sources, Event Listeners, Event classes, Handling action ,mouse and keyboard events, Adapter classes, Inner classes, Anonymous Inner classes.", "GUI programming with JavaFX: JavaFX basic concepts, JavaFX Application Structure, JavaFX Controls and Event handling."] },
          { "name": "UNIT – II Networking & Collections", "topics": ["Networking and Collection frame work: Networking: Networking API, Inet address, TCP/IP client sockets, URL, URL connection, HttpURL connection, Cookies, TCP/IP server sockets, Datagrams.", "Collections Frame work: Collection Interfaces, Collection Classes: Array Class, Vector Class, Stack Class, Dictionary class, Hash table Class. accessing using iterators, working with maps, comparators."] },
          { "name": "UNIT – III JDBC", "topics": ["Java Database Connectivity (JDBC): Introduction, JDBC Drivers, JDBC Architecture, JDBC Classes and Interfaces, Loading a Driver, Making a Connection, Execute SQL Statement, statement, prepared statement, callable statement, Retrieving Result, Getting Database Information, Scrollable and Updatable Resultset, Result Set Metadata."] },
          { "name": "UNIT – IV Servlets", "topics": ["Servlets: Servlet: Server-Side Java, Servlet Alternatives, Servlet Strengths, Servlet Architecture, Servlet Life Cycle, GenericServlet, HttpServlet, Exploring Servlet API, Handling HTTP Requests and Responses, Passing Parameters to Servlets, Retrieving Parameters, Session Tracking, Filters."] },
          { "name": "UNIT – V JSP", "topics": ["Java Server Pages(JSP): Problem with Servlets, Life Cycle of JSP Page, JSP Processing, JSP Application Design with MVC, Setting Up the JSP Environment. JSP Directives, JSP Action elements, JSP Implicit Objects, JSP Form Processing, JSP Session and Cookies Handling, JSP Session Tracking JSP Database Access, JSP Standard Tag Libraries, JSP Custom Tag, JSP Expression Language, JSP Exception Handling, JSP XML Processing, JSTL."] }
        ]
      },
      {
        "code": "PE3106IT",
        "title": "Advanced Data Structures",
        "units": [
          { "name": "UNIT-I Hashing", "topics": ["Hashing: General idea, Hash Function, Separate Chaining, Hash Tables without linked lists: Linear Probing, Quadratic Probing, Double Hashing, Rehashing, Extendible hashing."] },
          { "name": "UNIT-II Advanced Trees", "topics": ["Trees: Binary Search Trees (BST), AVL Trees, B-Trees, B+ Trees, Red-Black Trees, Splay Trees, Tries."] },
          { "name": "UNIT-III Graphs", "topics": ["Graphs: Topological sort, Shortest-path algorithms: Unweighted Shortest Paths, Dijkstra’s algorithm, Graphs with Negative Edge Costs, Acyclic Graphs, Network Flow Problems, Minimum Spanning Tree: Prim’s and Kruskal’s Algorithms."] },
          { "name": "UNIT-IV Flow & Search", "topics": ["Network Flow Problems: Simple Maximum-Flow Algorithm, Smart Greedy, Simple Minimum Cost Flow.", "Depth-First Search: Undirected Graphs, Biconnectivity, Euler Circuit, Directed Graphs, Finding Strong Components."] },
          { "name": "UNIT-V Pattern Matching", "topics": ["Pattern Matching: Introduction, Brute Force Pattern Matching, The Boyer-Moore Algorithm, The Knuth-Morris-Pratt Algorithm, Standard Tries, Compressed Tries, Suffix Tries."] }
        ]
      }
    ]
  },
  {
    "code": "HS3108-",
    "title": "Managerial Economics and Accountancy",
    "units": [
      { "name": "UNIT-I Managerial Economics", "topics": ["Meaning and Nature of Managerial Economics: Managerial Economics and its usefulness to Engineers, Fundamental Concepts of Managerial Economics-Scarcity, Marginalism, Equimarginalism, Opportunity costs, Discounting, Time Perspective, Risk and Uncertainty, Profits, Case study method."] },
      { "name": "UNIT-II Consumer Behavior", "topics": ["Consumer Behavior: Law of Demand, Determinants, Types of Demand; Elasticity of Demand (Price, Income and Cross-Elasticity); Demand Forecasting, Law of Supply and Concept of Equilibrium."] },
      { "name": "UNIT - III Production & Markets", "topics": ["Theory of Production and Markets: Production Function, Law of Variable Proportion, ISO quants, Economics of Scale, Cost of Production (Types and their measurement), Concept of Opportunity Cost, Concept of Revenue, Cost-Output relationship, Break-Even Analysis, Price - Output determination under Perfect Competition and Monopoly."] },
      { "name": "UNIT-IV Capital Management", "topics": ["Capital Management: Significance, determination and estimation of fixed and working capital requirements, sources of capital, Introduction to capital budgeting, methods of payback and discounted cash flow methods with problems."] },
      { "name": "UNIT-V Book-keeping", "topics": ["Book-keeping: Principles and significance of double entry book keeping, Journal, Subsidiary books, Ledger accounts, Trial Balance, concept and preparation of Final Accounts with simple adjustments, Analysis and interpretation of Financial Statements through Ratios."] }
    ]
  },
  {
    "code": "PC3109IT",
    "title": "Database Management Systems Lab",
    "units": [
      { "name": "Experiments", "topics": ["1. Database design with E-R Model", "2. Database design with Relational Model", "3. Practicing DDL commands", "4. Practicing DML commands", "5. Querying (using ANY, ALL, IN, Exists, NOT EXISTS, UNION, INTERSECT, Constraints etc.)", "6. Queries using Aggregate functions, GROUP BY, HAVING and Creation and dropping of Views.", "7. Triggers (Creation of insert trigger, delete trigger, update trigger)", "8. Usage of Cursors", "9. Basics of PL/SQL", "10. Stored Procedures"] }
    ]
  },
  {
    "code": "PE-I**",
    "title": "Professional Elective – I Lab",
    "isGroup": true,
    "variants": [
      {
        "code": "PE3110IT",
        "title": "Web Programming Lab",
        "units": [
          { "name": "Experiments", "topics": ["1. Design web pages for college with lists, tables, links.", "2. Create class timetable using table tag.", "3. Create user feedback form using various controls.", "4. Create web page using frame tag.", "5. Write html code to develop webpage having two frames.", "6. Create resume using HTML tags.", "7. Design web page of your home town with attractive background.", "8. Use Inline CSS to format resume.", "9. Use External CSS to format timetable.", "10. Use External, Internal, and Inline CSS to format college web page.", "11. Develop a JavaScript to display today’s date.", "12. Develop simple calculator using JavaScript.", "13. Create HTML page with JavaScript taking integer as input.", "14. Create HTML Page containing form with fields Name, Email etc.", "15. Implement Validation in above Feedback Form.", "16. Use regular expression for validation in Feedback Form.", "17. Using AJAX retrieve data from a TXT file and display it.", "18. Create XML file to store student information.", "19. Create DTD for above XML File.", "20. Create XSL file to convert above XML file into XHTML file.", "21. Write a PHP program to display today’s date in dd-mm-yyyy format.", "22. Write a PHP program to check if number is prime or not.", "23. Write a PHP program to print first 10 Fibonacci Numbers.", "24. Create HTML page containing textbox, submit / reset button.", "25. Write a PHP script to read data from txt file and display it in html table.", "26. Write a PHP script for login authentication.", "27. Write PHP Script for storing and retrieving user information from MySQL table.", "28. Write a PHP script for user authentication using PHP-MYSQL.", "29. Fetch information from a database with AJAX.", "30. Students have to create a whole Website which contains above topics."] }
        ]
      },
      {
        "code": "PE3111IT",
        "title": "Advanced Java Lab",
        "units": [
          { "name": "Experiments", "topics": ["1. Java Program to create login form with swing Components.", "2. Java Program to create student registration form with swing components.", "3. Java Program to demonstrate Jtree, Menus, Jtable in swing.", "4. Java Program to handle action events, key events, mouse events.", "5. Write simple JavaFx program to display “welcome message”", "6. Write JavaFx Program to insert image in window.", "7. Java program to create simple form using JavaFx.", "8. Java program to handle action events using JavaFx.", "9. Java Program to Create a Server for the purpose of URL supplied to URL class object", "10. Java Program to Create a Server that Receives Data from the Client Using BufferedReader and Sends Reply to the Client Using PrintStream", "11. Java Program that Accepts the Filename and Checks for its Existence.", "12. Java Program of a Client Program to Accept a File Name from the Keyboard and Send that Name to the Server.", "13. Java Program to Use Datagram Socket for Client Server Communication", "14. Demonstrate operations of Vector, ArrayList, LinkedList collection classes?", "15. Demonstrate operations of HashMap, TreeMap, LinkedHashMap collection classes?", "16. Demonstrate operations of HashSet, TreeSet, LinkedHashSet collection class", "17. Demonstrate operations of Stack, ArrayQueue, PriorityQueue collection classes?", "18. Create a phone directory with names and phone numbers using hash table?", "19. Java program to create a SQL table using JDBC and insert data value.", "20. Java program to insert, modify, update value in SQL table using JDBC.", "21. Java program to demonstrate prepared and callable statements.", "22. Java Program to demonstrate scrollable result set.", "23. Java Program to display meta data of a SQL table.", "24. Java Program to create HTTP servlet and display a Welcome message.", "25. Java Program to retrieve the details from login form and display using Servlet.", "26. Java Program to create servlet"] }
        ]
      },
      {
        "code": "PE3112IT",
        "title": "Advanced Data Structures Lab",
        "units": [
          { "name": "Experiments", "topics": ["1. Implementation various hash function and hashing techniques.", "2. Implementation of Binary search tree operations", "3. Implementation of AVL tree operations.", "4. Implementation of Splay tree operations.", "5. Implementation of B Tree operations.", "6. Implementation of B+ Tree operations", "7. Implementation of Graph Traversal methods", "8. Implementation of Topological sort.", "9. Implementation of Shortest Path Algorithms.", "10. Implementation of Simple Max flow Algorithm.", "11. Implementation of Knuth-Morris Pratt pattern matching Algorithm", "12. Implementation of Boyer-Moore pattern matching Algorithm"] }
        ]
      }
    ]
  }
];

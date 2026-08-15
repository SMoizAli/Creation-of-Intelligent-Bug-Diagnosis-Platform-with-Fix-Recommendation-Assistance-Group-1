# Task 3: Define Agent Responsibilities

- We have already touched on each **Agent's job**  while covering **1.1** . 
- Now we just need to go deeper and more formal for each agent: 
    + What input it takes
    + What it does 
    + What output it produces 

- This level of detail is what turns , into something you could actually code.


## Agent 1:Triage Agent 
- This is an agent which decides the  `seriousness level` of bug (Critical/minor)

+ Input: The structured bug record from the Bug Submission Module 

+ What it does :-
    * Reads the description and stack trace

    * Assign serverity leve `(Critical/High/Medium/Low)` based on things like: does the error type sound severe (e.g., crash vs. minor warning)? Does the language suggest major impact ("entire app crashes" vs "button color is wrong")?

    * Does it needs deep analysis or not 

    - `Note: at this stage, the stack trace is still raw/unparsed text — Triage Agent only skims it for severity signals, it doesn't extract structured details (that's Agent 2's job).`


+ Output : Now bug record is tagged with priority or seriousness level and passed to next agent 

## Agent 2:Log Analysis Agent 
-  This agent `extract the useful information` for messy error text 

-  Input : Raw Stack traces / messy error text 

-  What it does :-
   +  Extract useful information like error type:`IndentationError`,file,line at which error occured etc ...
   +  Cleans up the messy text into a structured format

-  Output : Error information in Structured format {error_type: "IndentationError", file: "app.py", line: 12}  and passed to next agent


## Agent 3:Root Cause Agent
- This agent Check , why and what happended 

- Input : Error information in Structured format from Log Analysis Agent 

- What it does:-
    + Checks  Error Type and Situation  to know the reason of the  cause — not just "line 12 broke" but "line 12 broke because the code had extra indent"
    + This is where the RAG/Knowledge Base gets queried — it looks up similar past bugs to see what the root cause turned out to be for those, and uses that as a reference

- Output : A short deatils on Why error happened and passed to next agent.

## Agent 4:Duplicate Detection Agent
Checks whether this or similar type of error had been solved before or not 

Input : The embedding (vector) of the new bug's description/stack trace

What it does:
Compares this vector against all vectors stored in the Vector Database using cosine similarity
If similarity score is above a certain threshold (e.g., >85%), it flags the bug as a likely duplicate of a specific past bug

Output: Either "No duplicate found" or "Likely duplicate of BUG-0633 (90% similarity)" — passed forward with the match info attached

## Agent 5 :Remediation Agent
- This Agent proposes a solution.

- Input  : Severity Level , Root Cause,  duplicate info , and any similar past bugs retrieved from the Knowledge Base

- What it does :- 
    + If the same error as solved before then , it can pull the fix that worked for the earlier bug
    + If it is new then , root cause + retrieved  similar type of case to  generate a suggested fix 

- Output: A structured summary — severity, root cause, duplicate status, and suggested fix — which then goes to the Structured Findings & Resolution Display mod


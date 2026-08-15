# Task 1: Study of Core Concepts
- 1.1 Defect Analysis Workflow
- 1.2 Understanding Bug Report Structure
- 1.3 Understanding Stack Traces
- 1.4 Learn RAG
- 1.5 Semantic Similarity

--- 

## 1.1 Defect Analysis Workflow
- Whenever a bug is reported , we directly  jus dont go and fix it but we rather understand it , analyse where the error happend , why the error happened( root cause ),  check that is already there in our database  or not , and suggest the fix.

- All this is done with the `5 agents` :
    - | SNo |   Agents  | Work they do |
      |------|----:|------|
      | 1. |Triage Agent| Figure out how serious/urgent it is  |
      | 2. |Log Analysis Agent| Analyse the technical error log and return useful parts  |
      | 3. |Root Cause  Agent| Why this happened  |
      | 4. |Duplicate Detection Agent| check if bug was already reported before  |      
      | 5. |Remediation Agent| Suggest a fix means fixing it  |

---      

## 1.2 Understanding Bug Report Structure
  - The user  provide the proper information about the error (Description or Stack trace)  like even photos or videos etc  , main RAG expects only Description or Stack trace but images and videos should also be expected 
  
  - A proper Report could be like : 
    + Error is occuring while submitting file
    + It is happening while you are submitting a specific or to all files
    + Is it disturbing or effecting the whole program or only a specific part of code or line 
    + Where it happened (like in particular browser or not)
    +  Stack trace / Error log the error system produce
    +  will also provide attachments like Screenshots, videos, etc ..

- A typical bug report also has structured metadata fields: Title, Severity (Critical/High/Medium/Low), and Environment (OS/browser/version) — but for our RAG system, the Description and Stack Trace are what matter most since those are the text we'll embed and search. 


---

## 1.3 Understanding Stack Traces
- A stack trace is what a program spits out automatically when it crashes.

- Here's a simple example (in Python):

> Traceback (most recent call last):
>  
 >File "app.py", line 45, in <module>
>    result = divide(10, 0)
>
>  File "app.py", line 12, in divide
>    return a / b
>
>ZeroDivisionError: division by zero

Let's break down what each part means:

- ZeroDivisionError — this is the type of error. This is actually the single most useful piece of information, because it tells you what kind of problem occurred (dividing by zero, in this case).

- File "app.py", line 45 and line 12 — these tell you exactly where in the code the problem happened (which file, which line).

- The order (top to bottom) — this shows you the sequence: the program started at line 45, which called a function divide(), and that function broke at line 12

- Basically it break and understand the error  and here Log Analysis agent ready the messy daata and returns the useful parts.

---  


## 1.4 Learn RAG

- **RAG = Retrival + Augmented + Generation**
   - Retrieval → search through your historical bug database and pull out the most relevant/similar past bugs.
   
   - Augmented → add those retrieved bugs as extra context to the system prompt.

   - Generation → now the system generates an answer/fix suggestion, using both its general knowledge AND the specific historical bugs you gave it.

- The "search the database first" part is retrieval; "then answer based on what you found" is generation.

So RAG not only retrives or just search exact error but search the similare error and relevent ones  from history ,even if worded differently  and uses them as a refernece to help analyse/suggest fix for current error/bug.

---

## 1.5 Semantic Similarity

- This explains how the "find similar past bugs" part of RAG actually works.
    + The problem: If you only search using exact keyword matching, you'll miss bugs that mean the same thing but are worded differently. Example:

    +   Bug A: "App crashes when password contains @ symbol"
    +   Bug B: "Login fails if special characters are used in password field"

- These use almost completely different words, but they're describing the same underlying bug. Keyword search would treat them as unrelated.
-  Semantic similarity catches that they're actually the same problem.
- How it works (simple version):

    1. Every piece of text (a bug description) gets converted into an embedding — a list of numbers that represents the meaning of that text (this is Task 9, Embedding Generation)


    2. Texts with similar meaning end up with numbers that are "close" to each other, mathematically
    
    3. To check how similar two bugs are, you calculate something called cosine similarity — a score between -1 and 1. Closer to 1 means very similar meaning, closer to 0 means unrelated.
    
- The Duplicate Detection Agent relies totally on this .Because it does not totally look for exact text matches but will compare embeddings and uses similarity scores, just like to say "The new bug is 95% similare to the previous bug". 

---





# Task 2: System Architecture Design

## 2.1 Overall System Architecture


> User

>   ↓
>
>
> Bug Submission Module  (accepts text paste or file upload)
>
>   ↓
>
>
> [Bug report gets stored + embedded]
>
>   ↓
>
> Multi-Agent Pipeline ──────────────┐
>                                                                              
>   ├─ Triage Agent─────────────────                  │
>                                       
>   ├─ Log Analysis Agent─────────────        │  ←── queries ──→  Historical Defect Knowledge Base (Vector DB / RAG)</p>
>                                       
>   ├─ Root Cause Agent──────────────                                │                                    
>                                       
>   ├─ Duplicate Detection Agent─────                    ←──┘                    
>
>   └─ Remediation Agent
>
>   ↓
>
>
> Structured Findings & Resolution Display
>
> 
>
---

## 2.2 Data Flow
 - In this step let us understand how the data will flow between users to agents and what happen's to the data  when the data is given by user 

- Let's trace one bug report's journey, step by step:

    1. Input (from User → Bug Submission Module)

        - In this step User paste's the error or bug with some description about it 
        - Example: 
            > Traceback (most recent call last):
            >  
            > File "app.py", line 45, in <module>
            >    result = divide(10, 0)
            >
            >  File "app.py", line 12, in divide
            >    return a / b
            >
            >ZeroDivisionError: division by zero
            Description : not able to run this 

    2. Bug Submission Module → storage

    - The submitted error is converted to  structured format  and is stored 

        >json  {
        >
        >    "bug_id": "BUG-0001",
        >
        >    "description": "not able to run this",
        >
        >   "stack_trace": "Traceback...ZeroDivisionError: division by zero",
        >
        >    "timestamp": "2026-07-02T10:00:00",
        >
        >    "source": "user_submission"
        >
        >  }

    - This is important — from this point on, your system works with structured data, not raw messy text as raw messy data makes it more complicated.

    3. Structured record → Chunking 

        - Long text  or long description are  splited  into smaller pieces ( into "chunks") ,  because models work better on smalle pieces of text than on larger ones.
        - Format would be like : a list of text chunks, e.g. `["chunk1 text...", "chunk2 text...", "chunk3 text..."]`

    4. Chunks → Embeddings 

        - Each chunk gets converted into a vector (a list of numbers, usually 384 or 768 numbers long depending on the model)
        - Example : [0.043, -0.041, 0.087, ..., 0.0005] — this number-list represents the meaning of that chunk

    5. Embeddings → Vector Database 

        - These vectors get stored in a special database like ChromaDB, which built for fast similarity search
        - Alongside each vector,we should  store the original text + bug_id, so that RAG system can trace it back to the actual bug report when needed . 

    6. New bug comes in → Retrieval 

        - When a new bug is submitted, it goes through the same chunking + embedding process
        - Its vector gets compared against all stored vectors using cosine similarity and most similar ones get retrived 
        
    7. Retrieved bugs → Agents

        - Those retrieved similar bugs get handed to agents like the Duplicate Detection Agent and Root Cause Agent as extra context to help them analyze the new bug
        and they fix bugs.

## 2.3 Tech Stack

>   - Language: Python
>   - UI/Bug Submission: Streamlit
>   - Embedding Model: sentence-transformers (all-MiniLM-L6-v2)
>   - Vector Database: ChromaDB
>   - Chunking: LangChain text splitters
>   - Data Processing: pandas
>   - Agent Orchestration: Python (custom classes) — may adopt LangChain/CrewAI in later milestones
>   - LLM (for future remediation generation): TBD based on access


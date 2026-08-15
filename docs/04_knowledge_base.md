# Task 4: Design the Knowledge Base

- Basically this task is about desiginig the blueprint or conceptual design that defines how data connects and is structured.basically, deciding exactly what information you'll store for each historical bug, and how it's organized, before you start actually building it (Tasks 6-11).


## Part 1: Knowledge Base Record Structure 

| Field     |              Purpose                     |      Example|
|:------|:-----|:------|
|bug_id |uniquie_id provided when an error is reported |Apc-2013|
|title |Short Summary |"App crashes  when login " |
|description|infomartion about the  bug |"When profile.ini is malformed, app crashes on launch..."|
|stack_trace|Raw technical error |"NullPointerException at ProfileLoader.java:88"|
|product/component|  Which part of software it belongs to  |"Firefox / Profile Manager"|
|severity|How serious |"Critical/Low"|
|resolution|How it was fixed|"Added null check before reading profile.ini"|
|status|Fixed / Open / Won't Fix|"Fixed"|
|source_dataset|Which dataset this came from|"Mozilla"|


## Part 2: How it connects to storage (linking back to Task 2)

> 
>Raw Kaggle dataset (CSV/JSON)
> 
>   ↓
> 
>Data Cleaning (Task 7) — remove nulls, fix formatting, drop irrelevant columns
> 
>   ↓
> 
>Each cleaned bug record → Chunking (Task 8) — split long description/resolution text
> 
>   ↓
> 
>Each chunk → Embedding (Task 9) — convert to vector
> 
>   ↓
> 
>Store in ChromaDB (Task 10):
> 
>   - the vector
> 
>   - the original text chunk
> 
>   - metadata: {bug_id, title, source_dataset, severity, resolution}
>


- When we  store a chunk in ChromaDB, we  don't just store the vector alone — we also attach metadata (bug_id, title, etc.) alongside it. This is what lets you trace a retrieved vector back to a full, readable bug report, instead of just getting back a meaningless list of numbers. 

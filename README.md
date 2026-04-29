# Healthcare_Database_Project
CSC 261 Database Project

## Run locally

Run the PHP/MySQL version from this folder:

```bash
php -S localhost:8004
```

Then visit `http://localhost:8004`.

Before running the site, import `Task C/create.sql` and `Task C/load.sql` into
MySQL, copy `api/config.example.php` to `api/config.php`, and fill in the
database credentials for your local machine or betaweb account.

## Static hosting

This folder uses PHP endpoints and a MySQL database, so it needs a PHP-capable
server such as betaweb. GitHub Pages can only host the static version.

## Project structure

```text
.
├── index.html
├── pages/
│   ├── appointments.html
│   ├── flowsheets.html
│   ├── patient.html
│   ├── profile.html
│   └── provider.html
├── css/
│   └── styles.css
├── js/
│   └── script.js
├── data/
│   └── compacted_data.json
├── Task C/
│   ├── create.sql
│   ├── load.sql
│   └── source CSV files
└── schema/
    └── Milestone1_tables.pdf
```

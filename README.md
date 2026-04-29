# Health Care Database Project

SmartChart is a web-based health care records system built for a database course project. It models a small clinical portal where patients, providers, and administrative users interact with appointment, flowsheet, prescription, and medication data.

Live site: https://betaweb.csug.rochester.edu/~mkhan35/betaweb/

## Overview

The project focuses on connecting a usable front end to a relational health care database. Patients can view their own profile, appointments, flowsheet values, and medication list. Providers can switch between patients, review clinical history, add observations, create prescriptions, and receive drug interaction warnings. Admin users have a higher-level view of system access and patient/provider records.

The application uses PHP endpoints to load and update data from MySQL, with HTML, CSS, and JavaScript handling the user interface.

## Key Features

- Role-based views for patients, providers, and admin staff
- Patient-specific appointment, medication, encounter, and flowsheet records
- Provider workflow for adding observations and prescriptions
- Drug interaction warning support using medication interaction data
- MySQL schema and load scripts based on the project dataset

## Technologies

- HTML, CSS, JavaScript
- PHP
- MySQL
- CSV and SQL data loading

## Local Setup

To run locally, import the database scripts in `database/create.sql` and `database/load.sql` into MySQL. Then copy `api/config.example.php` to `api/config.php` and fill in your local database credentials.

Start the PHP server from the project folder:

```bash
php -S localhost:8004
```

Then open:

```text
http://localhost:8004
```

## Project Structure

```text
.
├── api/          PHP endpoints for database-backed workflows
├── css/          Application styling
├── database/     SQL schema, load script, and source data files
├── js/           Front-end application logic
├── pages/        Patient, provider, profile, appointments, and flowsheet pages
├── schema/       Original project schema reference
└── index.html    Login and role selection entry point
```


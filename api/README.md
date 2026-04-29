# Task D API

These PHP files power the betaweb/MySQL version.

1. Import `Task C/create.sql` into MySQL.
2. Import `Task C/load.sql` into the same database.
3. Copy `api/config.example.php` to `api/config.php`.
4. Fill in the betaweb database credentials in `api/config.php`.
5. Test endpoints such as `api/patients.php` and `api/providers.php`.

The Task D frontend loads its main data through `api/bootstrap.php` and writes
supported workflows through these PHP endpoints.

# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Sign up for activities
- Browse clubs, request membership, and view membership status
- Let club leaders approve or reject requests and manage approved members

Club and membership data is stored in memory and resets when the server restarts.
For this exercise, the leader email (`club-leader@mergington.edu`) is used as
the only authorization check. Callers can claim this email, so it is not
production-grade authentication or authorization. Use a real authenticated
identity and role system before exposing member management in production.

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Run the application:

   ```
   python app.py
   ```

3. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Sign up for an activity                                             |
| GET    | `/clubs?student_email=student@mergington.edu`                     | Browse clubs and optionally see a student's membership status      |
| POST   | `/clubs/{club_id}/membership-requests`                             | Request membership (JSON body: `{"email":"student@mergington.edu"}`) |
| GET    | `/clubs/{club_id}/management?leader_email=...`                    | View pending requests and approved members as the demo leader       |
| POST   | `/clubs/{club_id}/membership-requests/{student_email}/approve?leader_email=...` | Approve a pending request |
| POST   | `/clubs/{club_id}/membership-requests/{student_email}/reject?leader_email=...`  | Reject a pending request |
| PATCH  | `/clubs/{club_id}/members/{student_email}?leader_email=...`        | Change role (JSON body: `{"role":"officer"}` or `{"role":"member"}`) |
| DELETE | `/clubs/{club_id}/members/{student_email}?leader_email=...`        | Remove an approved member                                          |

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

3. **Clubs and memberships** - Clubs list their associated activities; a
   student may have one pending or approved membership per club. Rejected
   students may submit a new request. Only approved members are included in
   member counts. Membership roles are `member` and `officer`.

All data is stored in memory, which means data will be reset when the server restarts.

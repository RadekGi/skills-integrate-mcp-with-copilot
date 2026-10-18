"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
from pathlib import Path

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}

# In-memory club database. A club's leader_email is only a demo authorization
# check; callers can claim any email because this app has no authentication.
clubs = {
    "chess-club": {
        "name": "Chess Club",
        "description": "Learn strategies and compete in chess tournaments",
        "leader_email": "club-leader@mergington.edu",
        "activity_names": ["Chess Club"],
    },
    "arts-club": {
        "name": "Arts Club",
        "description": "Explore visual arts and performance",
        "leader_email": "club-leader@mergington.edu",
        "activity_names": ["Art Club", "Drama Club"],
    },
    "stem-club": {
        "name": "STEM Club",
        "description": "Build skills in programming and mathematics",
        "leader_email": "club-leader@mergington.edu",
        "activity_names": ["Programming Class", "Math Club"],
    },
}

# One record per (club, student); rejected requests may be submitted again.
club_memberships = {}


class MembershipRequest(BaseModel):
    email: str


class MembershipRoleUpdate(BaseModel):
    role: Literal["member", "officer"]


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    email_parts = normalized.split("@")
    if (
        len(email_parts) != 2
        or not all(email_parts)
        or any(char.isspace() for char in normalized)
    ):
        raise HTTPException(status_code=422, detail="A valid email is required")
    return normalized


def get_club(club_id: str):
    if club_id not in clubs:
        raise HTTPException(status_code=404, detail="Club not found")
    return clubs[club_id]


def require_club_leader(club_id: str, leader_email: str):
    club = get_club(club_id)
    if normalize_email(leader_email) != club["leader_email"]:
        raise HTTPException(status_code=403, detail="Only this club's leader can manage members")
    return club


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.get("/clubs")
def get_clubs(student_email: str | None = None):
    student = normalize_email(student_email) if student_email else None
    result = []
    for club_id, club in clubs.items():
        membership = club_memberships.get((club_id, student)) if student else None
        approved_count = sum(
            1 for (member_club_id, _), record in club_memberships.items()
            if member_club_id == club_id and record["status"] == "approved"
        )
        result.append({
            "id": club_id,
            "name": club["name"],
            "description": club["description"],
            "activity_names": club["activity_names"],
            "member_count": approved_count,
            "membership_status": (
                membership["status"]
                if membership and membership["status"] in ("pending", "approved")
                else None
            ),
            "membership_role": membership["role"] if membership else None,
        })
    return result


@app.post("/clubs/{club_id}/membership-requests")
def request_club_membership(club_id: str, request: MembershipRequest):
    get_club(club_id)
    student = normalize_email(request.email)
    key = (club_id, student)
    membership = club_memberships.get(key)
    if membership and membership["status"] in ("pending", "approved"):
        raise HTTPException(
            status_code=409,
            detail=f"Membership is already {membership['status']}",
        )

    club_memberships[key] = {
        "email": student,
        "status": "pending",
        "role": None,
    }
    return {"message": f"Membership request sent to {clubs[club_id]['name']}"}


@app.get("/clubs/{club_id}/management")
def get_club_management(club_id: str, leader_email: str = Query(...)):
    require_club_leader(club_id, leader_email)
    pending_requests = []
    members = []
    for (member_club_id, _), membership in club_memberships.items():
        if member_club_id != club_id:
            continue
        if membership["status"] == "pending":
            pending_requests.append({"email": membership["email"]})
        elif membership["status"] == "approved":
            members.append({
                "email": membership["email"],
                "role": membership["role"],
            })
    return {"pending_requests": pending_requests, "members": members}


@app.post("/clubs/{club_id}/membership-requests/{student_email}/approve")
def approve_club_membership(
    club_id: str, student_email: str, leader_email: str = Query(...)
):
    require_club_leader(club_id, leader_email)
    membership = club_memberships.get((club_id, normalize_email(student_email)))
    if not membership or membership["status"] != "pending":
        raise HTTPException(status_code=404, detail="Pending membership request not found")
    membership["status"] = "approved"
    membership["role"] = "member"
    return {"message": f"Approved {membership['email']}"}


@app.post("/clubs/{club_id}/membership-requests/{student_email}/reject")
def reject_club_membership(
    club_id: str, student_email: str, leader_email: str = Query(...)
):
    require_club_leader(club_id, leader_email)
    membership = club_memberships.get((club_id, normalize_email(student_email)))
    if not membership or membership["status"] != "pending":
        raise HTTPException(status_code=404, detail="Pending membership request not found")
    membership["status"] = "rejected"
    membership["role"] = None
    return {"message": f"Rejected {membership['email']}"}


@app.patch("/clubs/{club_id}/members/{student_email}")
def update_club_member_role(
    club_id: str,
    student_email: str,
    update: MembershipRoleUpdate,
    leader_email: str = Query(...),
):
    require_club_leader(club_id, leader_email)
    membership = club_memberships.get((club_id, normalize_email(student_email)))
    if not membership or membership["status"] != "approved":
        raise HTTPException(status_code=404, detail="Approved member not found")
    membership["role"] = update.role
    return {"message": f"Updated {membership['email']}'s role to {update.role}"}


@app.delete("/clubs/{club_id}/members/{student_email}")
def remove_club_member(
    club_id: str, student_email: str, leader_email: str = Query(...)
):
    require_club_leader(club_id, leader_email)
    key = (club_id, normalize_email(student_email))
    membership = club_memberships.get(key)
    if not membership or membership["status"] != "approved":
        raise HTTPException(status_code=404, detail="Approved member not found")
    del club_memberships[key]
    return {"message": f"Removed {membership['email']} from {clubs[club_id]['name']}"}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str):
    """Sign up a student for an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str):
    """Unregister a student from an activity"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}

document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const clubsList = document.getElementById("clubs-list");
  const clubStudentForm = document.getElementById("club-student-form");
  const clubStudentEmail = document.getElementById("club-student-email");
  const clubLeaderEmail = document.getElementById("club-leader-email");

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.detail || "An error occurred");
    }
    return result;
  }

  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  async function fetchActivities() {
    try {
      const activities = await apiRequest("/activities");
      activitiesList.innerHTML = "";
      activitySelect.options.length = 1;

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";
        const spotsLeft =
          details.max_participants - details.participants.length;
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : "<p><em>No participants yet</em></p>";

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">${participantsHTML}</div>
        `;
        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.textContent =
        "Failed to load activities. Please try again later.";
      console.error("Error fetching activities:", error);
    }
  }

  async function fetchClubs() {
    const studentEmail = clubStudentEmail.value.trim();
    const url = studentEmail
      ? `/clubs?student_email=${encodeURIComponent(studentEmail)}`
      : "/clubs";

    try {
      const clubs = await apiRequest(url);
      clubsList.replaceChildren();
      clubs.forEach((club) => {
        const card = document.createElement("article");
        card.className = "club-card";
        card.dataset.clubId = club.id;

        const heading = document.createElement("h4");
        heading.textContent = club.name;
        const description = document.createElement("p");
        description.textContent = club.description;
        const activities = document.createElement("p");
        activities.textContent = `Activities: ${
          club.activity_names.length
            ? club.activity_names.join(", ")
            : "None currently assigned"
        }`;
        const count = document.createElement("p");
        count.textContent = `Members: ${club.member_count}`;
        const status = document.createElement("p");
        if (club.membership_status === "approved") {
          status.textContent = `Your membership: Approved (${club.membership_role})`;
        } else if (club.membership_status === "pending") {
          status.textContent = "Your membership: Request pending";
        } else {
          status.textContent = studentEmail
            ? "Your membership: Not a member"
            : "Enter your email above to check your membership";
        }

        const joinButton = document.createElement("button");
        joinButton.type = "button";
        joinButton.textContent = "Request to Join";
        joinButton.dataset.action = "join";
        joinButton.disabled =
          !studentEmail ||
          club.membership_status === "pending" ||
          club.membership_status === "approved";

        const manageButton = document.createElement("button");
        manageButton.type = "button";
        manageButton.textContent = "Manage Members";
        manageButton.dataset.action = "manage";

        card.append(
          heading,
          description,
          activities,
          count,
          status,
          joinButton,
          manageButton
        );
        clubsList.appendChild(card);
      });
    } catch (error) {
      clubsList.textContent = error.message || "Failed to load clubs.";
      console.error("Error fetching clubs:", error);
    }
  }

  function addActionButton(container, label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    container.appendChild(button);
  }

  async function loadClubManagement(clubId, card, leaderEmail) {
    const data = await apiRequest(
      `/clubs/${encodeURIComponent(
        clubId
      )}/management?leader_email=${encodeURIComponent(leaderEmail)}`
    );
    const panel = document.createElement("div");
    panel.className = "club-management";

    const pendingHeading = document.createElement("h5");
    pendingHeading.textContent = "Pending requests";
    panel.appendChild(pendingHeading);
    const requests = document.createElement("ul");
    data.pending_requests.forEach((request) => {
      const row = document.createElement("li");
      row.dataset.studentEmail = request.email;
      const email = document.createElement("span");
      email.textContent = request.email;
      row.appendChild(email);
      addActionButton(row, "Approve", "approve");
      addActionButton(row, "Reject", "reject");
      requests.appendChild(row);
    });
    if (!data.pending_requests.length) {
      const empty = document.createElement("li");
      empty.textContent = "No pending requests";
      requests.appendChild(empty);
    }
    panel.appendChild(requests);

    const membersHeading = document.createElement("h5");
    membersHeading.textContent = "Approved members";
    panel.appendChild(membersHeading);
    const members = document.createElement("ul");
    data.members.forEach((member) => {
      const row = document.createElement("li");
      row.dataset.studentEmail = member.email;
      const email = document.createElement("span");
      email.textContent = `${member.email} `;
      const role = document.createElement("select");
      ["member", "officer"].forEach((roleName) => {
        const option = document.createElement("option");
        option.value = roleName;
        option.textContent = roleName;
        option.selected = roleName === member.role;
        role.appendChild(option);
      });
      row.append(email, role);
      addActionButton(row, "Save role", "update-role");
      addActionButton(row, "Remove", "remove");
      members.appendChild(row);
    });
    if (!data.members.length) {
      const empty = document.createElement("li");
      empty.textContent = "No approved members";
      members.appendChild(empty);
    }
    panel.appendChild(members);

    card.querySelector(".club-management")?.remove();
    card.appendChild(panel);
  }

  async function handleClubAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest(".club-card");
    if (!card) return;

    const clubId = card.dataset.clubId;
    const action = button.dataset.action;
    const studentEmail = clubStudentEmail.value.trim();
    const leaderEmail = clubLeaderEmail.value.trim();

    try {
      if (action === "join") {
        if (!studentEmail) {
          throw new Error("Enter your student email before requesting membership");
        }
        const result = await apiRequest(
          `/clubs/${encodeURIComponent(clubId)}/membership-requests`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: studentEmail }),
          }
        );
        showMessage(result.message, "success");
        await fetchClubs();
        return;
      }

      if (!leaderEmail) {
        throw new Error("Enter the club leader email to manage members");
      }
      if (action === "manage") {
        await loadClubManagement(clubId, card, leaderEmail);
        return;
      }

      const row = button.closest("li");
      const memberEmail = row.dataset.studentEmail;
      const encodedClub = encodeURIComponent(clubId);
      const encodedEmail = encodeURIComponent(memberEmail);
      const leaderQuery = `leader_email=${encodeURIComponent(leaderEmail)}`;
      let result;
      if (action === "approve" || action === "reject") {
        result = await apiRequest(
          `/clubs/${encodedClub}/membership-requests/${encodedEmail}/${action}?${leaderQuery}`,
          { method: "POST" }
        );
      } else if (action === "update-role") {
        result = await apiRequest(
          `/clubs/${encodedClub}/members/${encodedEmail}?${leaderQuery}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: row.querySelector("select").value }),
          }
        );
      } else {
        result = await apiRequest(
          `/clubs/${encodedClub}/members/${encodedEmail}?${leaderQuery}`,
          { method: "DELETE" }
        );
      }

      showMessage(result.message, "success");
      await fetchClubs();
      const refreshedCard = Array.from(
        clubsList.querySelectorAll(".club-card")
      ).find((clubCard) => clubCard.dataset.clubId === clubId);
      if (refreshedCard) {
        await loadClubManagement(clubId, refreshedCard, leaderEmail);
      }
    } catch (error) {
      showMessage(error.message || "The request failed", "error");
      console.error("Club membership action failed:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const result = await apiRequest(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      showMessage(result.message, "success");
      fetchActivities();
    } catch (error) {
      showMessage(error.message || "Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value;
    const activity = activitySelect.value;

    try {
      const result = await apiRequest(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        { method: "POST" }
      );
      showMessage(result.message, "success");
      signupForm.reset();
      fetchActivities();
    } catch (error) {
      showMessage(error.message || "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  clubStudentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    fetchClubs();
  });
  clubsList.addEventListener("click", handleClubAction);

  fetchActivities();
  fetchClubs();
});

const header = document.querySelector("[data-header]");
const form = document.querySelector(".email-form");
const message = document.querySelector(".form-message");
const tribeCard = document.querySelector(".tribe-card");
const cardName = document.querySelector("[data-card-name]");
const cardCode = document.querySelector("[data-card-code]");
const mailLink = document.querySelector("[data-mail-link]");

const getLocalMemberId = () => {
  const currentCount = Number(localStorage.getItem("fsTribeCount") || "0") + 1;
  localStorage.setItem("fsTribeCount", String(currentCount));

  return {
    memberCode: `FS-${String(currentCount).padStart(3, "0")}-01`,
    memberNumber: currentCount,
    isLocalPreview: true,
  };
};

const getMemberId = async ({ email, name }) => {
  if (window.location.protocol === "file:") {
    return getLocalMemberId();
  }

  const response = await fetch("/.netlify/functions/next-member-id", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, name }),
  });

  if (!response.ok) {
    throw new Error("Member ID request failed");
  }

  return response.json();
};

const subscribeToKlaviyo = async ({ email, name, memberCode, memberNumber }) => {
  const companyId = form?.dataset.klaviyoCompanyId?.trim();
  const listId = form?.dataset.klaviyoListId?.trim();

  if (!companyId || !listId) {
    return { skipped: true };
  }

  const [firstName, ...lastNameParts] = name.split(" ").filter(Boolean);
  const body = {
    data: {
      type: "subscription",
      attributes: {
        custom_source: "Fearless Society Landing Page",
        profile: {
          data: {
            type: "profile",
            attributes: {
              email,
              ...(firstName ? { first_name: firstName } : {}),
              ...(lastNameParts.length ? { last_name: lastNameParts.join(" ") } : {}),
              properties: {
                fs_member_id: memberCode,
                fs_member_number: memberNumber,
                fs_rank: "Tribe Founder",
                fs_access: "First Drop - Limited Pre-Order",
                fs_shipping_window: "4-6 weeks",
              },
            },
          },
        },
      },
      relationships: {
        list: {
          data: {
            type: "list",
            id: listId,
          },
        },
      },
    },
  };

  const response = await fetch(`https://a.klaviyo.com/client/subscriptions/?company_id=${encodeURIComponent(companyId)}`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      revision: "2026-04-15",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Klaviyo subscription failed");
  }

  return { skipped: false };
};

const maskEmail = (email) => {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, name.length - 2))}@${domain}`;
};

const updateHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 18);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim();

  if (!email) {
    message.textContent = "Enter your email to request early access.";
    return;
  }

  const displayName = name || email;
  const credentialName = name || maskEmail(email);

  let memberCode;
  let memberNumber;

  try {
    message.textContent = "Securing early access...";
    const member = await getMemberId({ email, name });
    memberCode = member.memberCode;
    memberNumber = member.memberNumber;
    await subscribeToKlaviyo({ email, name, memberCode, memberNumber });
  } catch (error) {
    message.textContent = "We could not connect to early access. Please try again.";
    return;
  }

  const subject = `Welcome to Fearless Society ${memberCode}`;
  const body = [
    `Welcome to the FS Tribe.`,
    ``,
    `Name: ${displayName}`,
    `Membership: ${memberCode}`,
    `Access: First Drop - Limited Pre-Order`,
    `Ships: 4-6 weeks after order confirmation`,
    ``,
    `Fear Nothing. Become Everything.`,
    `Built with intention. No shortcuts.`,
    `Fearless Society -2T17-`,
  ].join("\n");

  if (cardName && cardCode && mailLink && tribeCard) {
    cardName.textContent = credentialName;
    cardCode.textContent = memberCode;
    mailLink.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    tribeCard.hidden = false;
  }

  form.reset();
  message.textContent = `Welcome card generated: ${memberCode}. First drop access confirmed.`;
});
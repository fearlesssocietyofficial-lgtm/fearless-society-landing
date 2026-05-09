import { getStore } from "@netlify/blobs";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const formatMemberCode = (number) => `FS-${String(number).padStart(3, "0")}-01`;

const json = (statusCode, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

const getEmailKey = async (email) => {
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `member:${hash}`;
};

export default async (request) => {
  if (request.method === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Invalid request body" });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const name = String(payload.name || "").trim();

  if (!email || !email.includes("@")) {
    return json(400, { error: "Email is required" });
  }

  const store = getStore("fs-tribe");
  const memberKey = await getEmailKey(email);
  const existingMember = await store.get(memberKey, { type: "json", consistency: "strong" });

  if (existingMember?.memberCode) {
    return json(200, {
      memberCode: existingMember.memberCode,
      memberNumber: existingMember.memberNumber,
      isExisting: true,
    });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await store.getWithMetadata("counter", {
      type: "json",
      consistency: "strong",
    });

    const count = Number(current?.data?.count || 0);
    const nextNumber = count + 1;
    const memberCode = formatMemberCode(nextNumber);
    const counterOptions = current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true };

    try {
      await store.setJSON("counter", { count: nextNumber, updatedAt: new Date().toISOString() }, counterOptions);
      await store.setJSON(memberKey, {
        email,
        name,
        memberCode,
        memberNumber: nextNumber,
        rank: "Tribe Founder",
        createdAt: new Date().toISOString(),
      }, { onlyIfNew: true });

      return json(200, {
        memberCode,
        memberNumber: nextNumber,
        isExisting: false,
      });
    } catch {
      const memberAfterRace = await store.get(memberKey, { type: "json", consistency: "strong" });

      if (memberAfterRace?.memberCode) {
        return json(200, {
          memberCode: memberAfterRace.memberCode,
          memberNumber: memberAfterRace.memberNumber,
          isExisting: true,
        });
      }
    }
  }

  return json(409, { error: "Could not allocate member ID. Please try again." });
};

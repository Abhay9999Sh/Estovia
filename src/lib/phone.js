const INDIAN_PHONE_RE = /^[6-9]\d{9}$/;

export function isValidIndianPhone(value) {
  if (typeof value !== "string") return false;
  let num = value.replace(/[\s\-()]/g, "").trim();
  if (num.startsWith("+91")) num = num.slice(3);
  if (num.startsWith("0") && num.length === 11) num = num.slice(1);
  return INDIAN_PHONE_RE.test(num);
}

export const PHONE_ERROR = "Phone number must be a valid 10-digit Indian mobile number.";

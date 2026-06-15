import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import type { AppSettings, JobRecord, UserRecord } from "../shared/types.js";
import { getEffectiveAppSettings } from "./appSettingsStore.js";
import { config } from "./config.js";

type MeetingInvite = {
  job: JobRecord;
  admin: UserRecord;
  startsAt: Date;
  durationMinutes: number;
  message: string;
  settings?: AppSettings;
};

type SmtpConfig = Pick<AppSettings, "smtpHost" | "smtpPort" | "smtpSecure" | "smtpUser" | "smtpPass" | "emailFrom" | "emailFromName">;

const smtpTimeoutMs = 15_000;

const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

const foldIcsLine = (line: string) => {
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    chunks.push(remaining.slice(0, 75));
    remaining = ` ${remaining.slice(75)}`;
  }
  chunks.push(remaining);
  return chunks.join("\r\n");
};

const formatIcsDate = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const messageWithJobDescription = (message: string, jobDescription?: string | null) => {
  const trimmedMessage = message.trim();
  const trimmedDescription = jobDescription?.trim();
  if (!trimmedDescription || trimmedMessage.includes(trimmedDescription)) {
    return trimmedMessage;
  }

  return [
    trimmedMessage,
    "",
    `Job description: ${trimmedDescription}`
  ].filter(Boolean).join("\n");
};

const encodeHeader = (value: string) => {
  if (/[\r\n]/.test(value)) {
    throw new Error("Email header contains invalid control characters.");
  }

  if (/^[\x20-\x7e]*$/.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
};

const encodeDisplayName = (name: string) => {
  if (/[\r\n]/.test(name)) {
    throw new Error("Email display name contains invalid control characters.");
  }

  if (!/^[\x20-\x7e]*$/.test(name)) {
    return encodeHeader(name);
  }

  return `"${name.replace(/["\\]/g, "\\$&")}"`;
};

const encodeAddress = (name: string, email: string) => `${encodeDisplayName(name)} <${email}>`;

const stripUnsafeEmail = (email: string) => {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || /[\r\n]/.test(trimmed)) {
    throw new Error("Invite recipient email is invalid.");
  }
  return trimmed;
};

const dotStuff = (message: string) =>
  message
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => line.startsWith(".") ? `.${line}` : line)
    .join("\r\n");

export const buildMeetingInviteIcs = ({ job, admin, startsAt, durationMinutes, message, settings }: MeetingInvite) => {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const attendeeEmail = stripUnsafeEmail(job.userEmail ?? "");
  const organizerEmail = stripUnsafeEmail(settings?.emailFrom || config.email.from || admin.email);
  const summary = `Interview: ${job.jobTitle}`;
  const inviteMessage = messageWithJobDescription(message, job.jobDescription);
  const description = [
    inviteMessage,
    "",
    `Candidate: ${job.userName ?? "Candidate"} <${attendeeEmail}>`,
    `Role: ${job.jobTitle}`
  ].filter(Boolean).join("\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Roos//Meeting Invite//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@roos`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startsAt)}`,
    `DTEND:${formatIcsDate(endsAt)}`,
    foldIcsLine(`SUMMARY:${escapeIcsText(summary)}`),
    foldIcsLine(`DESCRIPTION:${escapeIcsText(description)}`),
    foldIcsLine(`ORGANIZER;CN=${escapeIcsText(admin.name)}:mailto:${organizerEmail}`),
    foldIcsLine(`ATTENDEE;CN=${escapeIcsText(job.userName ?? "Candidate")};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}`),
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
};

export const buildMeetingInviteMessage = (invite: MeetingInvite) => {
  const recipient = stripUnsafeEmail(invite.job.userEmail ?? "");
  const settings = invite.settings;
  const from = stripUnsafeEmail(settings?.emailFrom || config.email.from || invite.admin.email);
  const boundary = `roos-${crypto.randomBytes(12).toString("hex")}`;
  const subject = `Interview invitation for ${invite.job.jobTitle}`;
  const ics = buildMeetingInviteIcs(invite);
  const inviteMessage = messageWithJobDescription(invite.message, invite.job.jobDescription);
  const body = [
    inviteMessage,
    "",
    `Role: ${invite.job.jobTitle}`,
    "",
    "A calendar invitation is attached."
  ].filter(Boolean).join("\n");

  return {
    from,
    recipient,
    data: [
      `From: ${encodeAddress(settings?.emailFromName || config.email.fromName, from)}`,
      `To: ${encodeAddress(invite.job.userName ?? "Candidate", recipient)}`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      body,
      "",
      `--${boundary}`,
      "Content-Type: text/calendar; charset=utf-8; method=REQUEST; name=invite.ics",
      "Content-Disposition: attachment; filename=invite.ics",
      "Content-Transfer-Encoding: 8bit",
      "",
      ics,
      "",
      `--${boundary}--`,
      ""
    ].join("\r\n")
  };
};

const requireSmtpConfig = (emailConfig: SmtpConfig) => {
  if (!emailConfig.smtpHost || !emailConfig.smtpUser || !emailConfig.smtpPass || !emailConfig.emailFrom) {
    throw new Error("Email service is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM or SMTP_USER.");
  }
};

const createSocket = (emailConfig: SmtpConfig): Promise<net.Socket | tls.TLSSocket> =>
  new Promise((resolve, reject) => {
    const host = emailConfig.smtpHost ?? "";
    const onError = (error: Error) => reject(error);
    const socket = emailConfig.smtpSecure
      ? tls.connect({ port: emailConfig.smtpPort, host, servername: host }, () => {
          socket.off("error", onError);
          resolve(socket);
        })
      : net.connect(emailConfig.smtpPort, host, () => {
          socket.off("error", onError);
          resolve(socket);
        });

    socket.setTimeout(smtpTimeoutMs, () => {
      socket.destroy(new Error("SMTP connection timed out."));
    });
    socket.once("error", onError);
  });

const createSmtpSession = (socket: net.Socket | tls.TLSSocket) => {
  let buffer = "";
  const pending: Array<{
    resolve: (line: string) => void;
    reject: (error: Error) => void;
  }> = [];

  const readResponses = () => {
    const lines = buffer.split(/\r\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (/^\d{3} /.test(line)) {
        pending.shift()?.resolve(line);
      }
    }
  };

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    readResponses();
  });
  socket.on("error", (error) => {
    while (pending.length > 0) {
      pending.shift()?.reject(error);
    }
  });

  const read = () => new Promise<string>((resolve, reject) => {
    pending.push({ resolve, reject });
    readResponses();
  });

  const command = async (value: string, expectedCodes: number[]) => {
    socket.write(`${value}\r\n`);
    const line = await read();
    const code = Number(line.slice(0, 3));
    if (!expectedCodes.includes(code)) {
      throw new Error(`SMTP command failed: ${line}`);
    }
    return line;
  };

  return { read, command };
};

const upgradeSocketToTls = (socket: net.Socket | tls.TLSSocket, servername: string) =>
  new Promise<tls.TLSSocket>((resolve, reject) => {
    socket.removeAllListeners("data");
    socket.removeAllListeners("error");
    const secureSocket = tls.connect({ socket, servername }, () => {
      secureSocket.off("error", reject);
      resolve(secureSocket);
    });
    secureSocket.setTimeout(smtpTimeoutMs, () => {
      secureSocket.destroy(new Error("SMTP TLS negotiation timed out."));
    });
    secureSocket.once("error", reject);
  });

const sendSmtpMessage = async ({
  from,
  recipient,
  data,
  settings
}: {
  from: string;
  recipient: string;
  data: string;
  settings: AppSettings;
}) => {
  requireSmtpConfig(settings);
  let socket = await createSocket(settings);
  let session = createSmtpSession(socket);

  try {
    let line = await session.read();
    if (!line.startsWith("220")) {
      throw new Error(`SMTP connection failed: ${line}`);
    }

    await session.command(`EHLO ${config.host || "localhost"}`, [250]);
    if (!settings.smtpSecure) {
      await session.command("STARTTLS", [220]);
      socket = await upgradeSocketToTls(socket, settings.smtpHost ?? "");
      session = createSmtpSession(socket);
      await session.command(`EHLO ${config.host || "localhost"}`, [250]);
    }

    await session.command("AUTH LOGIN", [334]);
    await session.command(Buffer.from(settings.smtpUser ?? "", "utf8").toString("base64"), [334]);
    await session.command(Buffer.from(settings.smtpPass ?? "", "utf8").toString("base64"), [235]);
    await session.command(`MAIL FROM:<${from}>`, [250]);
    await session.command(`RCPT TO:<${recipient}>`, [250, 251]);
    await session.command("DATA", [354]);
    socket.write(`${dotStuff(data)}\r\n.\r\n`);
    line = await session.read();
    if (!line.startsWith("250")) {
      throw new Error(`SMTP message failed: ${line}`);
    }
    await session.command("QUIT", [221]);
  } finally {
    socket.end();
  }
};

export const sendMeetingInvite = async (invite: MeetingInvite) => {
  const settings = await getEffectiveAppSettings();
  const message = buildMeetingInviteMessage({ ...invite, settings });
  await sendSmtpMessage({ ...message, settings });
};

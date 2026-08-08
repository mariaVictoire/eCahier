"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button, Field, Input, Select } from "@/components/ui";
import { formatDateLongFr, formatHmRangeFr } from "@/lib/datetime";

type Period = "week" | "month" | "year";
type AttendancePeriod = Period | "day";

function todayInputDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type ReportData = {
  period: Period;
  title: string;
  rangeLabel: string;
  generatedAt: string;
  school: { id: string; name: string; city?: string | null } | null;
  adminName: string;
  metrics: {
    expected: number;
    done: number;
    missing: number;
    validated: number;
    draft: number;
    fillRatePercent: number;
    attendancePresent?: number;
    attendanceAbsent?: number;
    attendanceLate?: number;
  };
  byTeacher: { teacherId: string; name: string; done: number; missing: number }[];
  byClassroom: { classroomId: string; name: string; done: number; missing: number }[];
  recentSessions: {
    id: string;
    date: string;
    classroom: string;
    subject: string;
    teacher: string;
    status: string;
    title: string;
  }[];
  missingSlots: {
    id: string;
    date: string;
    startsAt: string;
    endsAt: string;
    classroom: string;
    subject: string;
    teacher: string;
  }[];
};

type CahierData = {
  period: Period;
  periodTitle: string;
  rangeLabel: string;
  classroom: {
    id: string;
    name: string;
    schoolName: string;
    schoolCity?: string | null;
    schoolYear: string;
  };
  sessions: {
    id: string;
    date: string;
    timeRange: string;
    subject: string;
    teacher: string;
    room: string;
    status: string;
    title: string;
    content: string;
    exercises: string;
    homeworkText: string;
    homeworkDueOn: string | null;
    observations: string;
    signatureImage: string | null;
    validatedAt: string | null;
  }[];
  generatedAt: string;
};

type AttendanceData = {
  period: Period | "day";
  periodTitle: string;
  rangeLabel: string;
  day?: string | null;
  classroom: {
    id: string;
    name: string;
    schoolName: string;
    schoolCity?: string | null;
    schoolYear: string;
  };
  sessionCount: number;
  studentCount: number;
  totals: { present: number; absent: number; late: number };
  items: {
    studentId: string;
    lastName: string;
    firstName: string;
    present: number;
    absent: number;
    late: number;
    sessions: number;
    absentDates?: string[];
    lateDates?: string[];
  }[];
  dayRows?: {
    studentId: string;
    lastName: string;
    firstName: string;
    sessionId: string;
    subject: string;
    timeRange: string;
    status: "present" | "absent" | "late";
  }[];
  generatedAt: string;
};

function statusLabel(status: "present" | "absent" | "late") {
  if (status === "absent") return "Absent";
  if (status === "late") return "En retard";
  return "Présent";
}

const COLORS = {
  green: "#009e60",
  greenDeep: "#006b3f",
  greenDark: "#004d2e",
  gold: "#e6b800",
  blue: "#3a75c4",
  purple: "#7c5cbf",
  orange: "#e08a3c",
  text: "#14201a",
  muted: "#5a6a61",
  stroke: "#d4ddd7",
  bg: "#f3f5f2",
  white: "#ffffff",
};

function Kpi({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  accent: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: 16,
        boxShadow: "0 8px 24px rgba(20,32,26,0.06)",
        border: `1px solid ${COLORS.stroke}`,
        borderLeft: `5px solid ${accent}`,
        padding: "16px 18px",
        minHeight: 92,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: COLORS.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 30,
          fontWeight: 800,
          color: COLORS.text,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 4, fontSize: 12, color: COLORS.muted }}>{hint}</div>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: COLORS.white,
        borderRadius: 18,
        border: `1px solid ${COLORS.stroke}`,
        boxShadow: "0 8px 24px rgba(20,32,26,0.05)",
        padding: 18,
        minHeight: 260,
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: COLORS.text,
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function HorizontalBars({
  rows,
}: {
  rows: { label: string; value: number; max: number }[];
}) {
  if (rows.length === 0) {
    return (
      <div style={{ color: COLORS.muted, fontSize: 13 }}>Aucune donnée</div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {rows.map((row) => {
        const width = row.max === 0 ? 0 : Math.round((row.value / row.max) * 100);
        return (
          <div key={row.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 6,
                fontSize: 13,
              }}
            >
              <span style={{ color: COLORS.text, fontWeight: 600 }}>{row.label}</span>
              <span style={{ color: COLORS.muted, fontWeight: 700 }}>{row.value}</span>
            </div>
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: "#e8f0ec",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${COLORS.green} 0%, ${COLORS.blue} 100%)`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusDonut({
  validated,
  draft,
  missing,
}: {
  validated: number;
  draft: number;
  missing: number;
}) {
  const total = Math.max(1, validated + draft + missing);
  const v = (validated / total) * 100;
  const d = (draft / total) * 100;
  const gradient = `conic-gradient(${COLORS.green} 0 ${v}%, ${COLORS.gold} ${v}% ${v + d}%, ${COLORS.orange} ${v + d}% 100%)`;

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: gradient,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: COLORS.white,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, lineHeight: 1 }}>
            {validated + draft + missing}
          </div>
          <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>total</div>
        </div>
      </div>
      <div style={{ flex: 1, display: "grid", gap: 10 }}>
        {[
          { label: "Validées", value: validated, color: COLORS.green },
          { label: "Brouillons", value: draft, color: COLORS.gold },
          { label: "Manquantes", value: missing, color: COLORS.orange },
        ].map((item) => (
          <div key={item.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              <span style={{ color: COLORS.muted }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: item.color,
                    marginRight: 6,
                  }}
                />
                {item.label}
              </span>
              <span style={{ fontWeight: 700, color: COLORS.text }}>{item.value}</span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "#eef2f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round((item.value / total) * 100)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerticalBars({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <div style={{ color: COLORS.muted, fontSize: 13 }}>Aucune activité</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        height: 170,
        paddingTop: 8,
      }}
    >
      {rows.map((row) => {
        const h = Math.max(8, Math.round((row.value / max) * 130));
        return (
          <div
            key={row.label}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
              {row.value}
            </div>
            <div
              style={{
                width: "100%",
                maxWidth: 42,
                height: h,
                borderRadius: "12px 12px 8px 8px",
                background: `linear-gradient(180deg, ${COLORS.green} 0%, #7fd4ad 100%)`,
              }}
            />
            <div
              style={{
                fontSize: 10,
                color: COLORS.muted,
                textAlign: "center",
                lineHeight: 1.2,
                minHeight: 28,
              }}
            >
              {row.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportDocument({
  report,
  schoolName,
}: {
  report: ReportData;
  schoolName: string;
}) {
  const schoolLabel = report.school?.name || schoolName;
  const city = report.school?.city || "Gabon";
  const fillHint =
    report.metrics.expected > 0
      ? `${report.metrics.fillRatePercent} %`
      : "—";

  const teacherBars = report.byTeacher
    .slice(0, 5)
    .map((t) => ({
      label: t.name,
      value: t.done,
      max: Math.max(1, ...report.byTeacher.slice(0, 5).map((x) => x.done)),
    }));

  const classroomBars = report.byClassroom
    .slice(0, 5)
    .map((c) => ({
      label: c.name,
      value: c.done,
      max: Math.max(1, ...report.byClassroom.slice(0, 5).map((x) => x.done)),
    }));

  // Synthèse visuelle “activité” à partir des top enseignants (proxy lisible)
  const activityRows = report.byTeacher.slice(0, 6).map((t) => ({
    label: t.name.split(" ").slice(-1)[0] || t.name,
    value: t.done,
  }));

  const missingPreview = report.missingSlots.slice(0, 5);

  return (
    <div
      style={{
        width: 1180,
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
        borderRadius: 24,
        overflow: "hidden",
        border: `1px solid ${COLORS.stroke}`,
      }}
    >
      {/* Bandeau tricolore */}
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${COLORS.green} 0 34%, ${COLORS.gold} 34% 66%, ${COLORS.blue} 66% 100%)`,
        }}
      />

      {/* Header sombre */}
      <div
        style={{
          background: `linear-gradient(120deg, ${COLORS.greenDark} 0%, ${COLORS.greenDeep} 55%, #0b5c8c 100%)`,
          color: COLORS.white,
          padding: "22px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "rgba(255,255,255,0.14)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              eC
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {schoolLabel}
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                background: "rgba(230,184,0,0.22)",
                color: "#fff6d6",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 12px",
              }}
            >
              {report.title}
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.92 }}>
            {report.rangeLabel}
            {city ? ` · ${city}` : ""}
          </div>
        </div>

        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.35)",
            flexShrink: 0,
            background: `linear-gradient(180deg, ${COLORS.green} 0 33%, ${COLORS.gold} 33% 66%, ${COLORS.blue} 66% 100%)`,
          }}
          aria-hidden
        />
      </div>

      <div style={{ padding: 22 }}>
        {/* KPI 2×4 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          <Kpi label="Créneaux prévus" value={report.metrics.expected} accent={COLORS.green} />
          <Kpi
            label="Séances saisies"
            value={report.metrics.done}
            accent={COLORS.gold}
            hint={fillHint}
          />
          <Kpi
            label="Non renseignées"
            value={report.metrics.missing}
            accent={COLORS.blue}
          />
          <Kpi
            label="Taux de saisie"
            value={`${report.metrics.fillRatePercent}%`}
            accent={COLORS.greenDeep}
          />
          <Kpi label="Validées" value={report.metrics.validated} accent={COLORS.green} />
          <Kpi label="Brouillons" value={report.metrics.draft} accent={COLORS.gold} />
          <Kpi
            label="Enseignants suivis"
            value={report.byTeacher.length}
            accent={COLORS.blue}
          />
          <Kpi
            label="Classes suivies"
            value={report.byClassroom.length}
            accent={COLORS.greenDeep}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
            marginTop: 14,
          }}
        >
          <Kpi
            label="Présences élèves"
            value={report.metrics.attendancePresent ?? 0}
            accent={COLORS.green}
          />
          <Kpi
            label="Absences"
            value={report.metrics.attendanceAbsent ?? 0}
            accent="#c0392b"
          />
          <Kpi
            label="Retards"
            value={report.metrics.attendanceLate ?? 0}
            accent={COLORS.orange}
          />
        </div>

        {/* Ligne milieu */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 14,
            marginTop: 14,
          }}
        >
          <Panel title="Activité · par enseignant">
            <VerticalBars rows={activityRows} />
          </Panel>
          <Panel title="Par statut">
            <StatusDonut
              validated={report.metrics.validated}
              draft={report.metrics.draft}
              missing={report.metrics.missing}
            />
          </Panel>
        </div>

        {/* Ligne bas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginTop: 14,
          }}
        >
          <Panel title="Par classe">
            <HorizontalBars rows={classroomBars} />
          </Panel>

          <Panel title="Créneaux à compléter">
            {missingPreview.length === 0 ? (
              <div style={{ color: COLORS.greenDeep, fontSize: 14, fontWeight: 600 }}>
                Aucun créneau manquant sur la période.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: COLORS.muted, textAlign: "left" }}>
                    <th style={{ padding: "0 0 10px", fontWeight: 600 }}>Créneau</th>
                    <th style={{ padding: "0 0 10px", fontWeight: 600 }}>Classe</th>
                    <th style={{ padding: "0 0 10px", fontWeight: 600 }}>Enseignant</th>
                  </tr>
                </thead>
                <tbody>
                  {missingPreview.map((item) => (
                    <tr key={item.id} style={{ borderTop: `1px solid ${COLORS.stroke}` }}>
                      <td style={{ padding: "10px 0", fontWeight: 600 }}>
                        {formatHmRangeFr(item.startsAt, item.endsAt)}
                        <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 500 }}>
                          {item.subject}
                        </div>
                      </td>
                      <td style={{ padding: "10px 0" }}>{item.classroom}</td>
                      <td style={{ padding: "10px 0", color: COLORS.muted }}>{item.teacher}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        {/* Petite ligne enseignants */}
        <div style={{ marginTop: 14 }}>
          <Panel title="Remplissage · par enseignant">
            <HorizontalBars rows={teacherBars} />
          </Panel>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "0 22px 18px" }}>
        <div
          style={{
            height: 3,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${COLORS.green} 0 34%, ${COLORS.gold} 34% 66%, ${COLORS.blue} 66% 100%)`,
          }}
        />
        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 12,
            color: COLORS.muted,
          }}
        >
          eCahier · Cahier de textes numérique · {schoolLabel}
          {city ? ` · ${city}` : ""} · Rapport généré le {formatDateLongFr(report.generatedAt)}
          {report.adminName ? ` · ${report.adminName}` : ""}
        </div>
      </div>
    </div>
  );
}

function CahierDocument({ cahier }: { cahier: CahierData }) {
  const city = cahier.classroom.schoolCity;
  const paper = "#fbf7ef";
  const line = "#d7e2f0";
  const margin = "#e8a0a0";
  const ink = "#1f2a24";

  return (
    <div
      style={{
        width: 820,
        background: paper,
        color: ink,
        fontFamily: "Georgia, 'Times New Roman', serif",
        border: "1px solid #d8cfc0",
        boxShadow: "0 10px 30px rgba(40,30,10,0.08)",
      }}
    >
      {/* En-tête type page de cahier */}
      <div
        style={{
          padding: "28px 36px 18px",
          borderBottom: "2px solid #c9bda8",
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#7a6f5d",
            fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
          }}
        >
          République gabonaise · Cahier de textes
        </div>
        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.greenDark,
          }}
        >
          {cahier.classroom.schoolName}
        </div>
        <div
          style={{
            marginTop: 6,
            textAlign: "center",
            fontSize: 14,
            color: "#6b6254",
            fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
          }}
        >
          {city ? `${city} · ` : ""}
          Année scolaire {cahier.classroom.schoolYear}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
            fontSize: 13,
          }}
        >
          <div
            style={{
              borderBottom: "1px solid #b7aa95",
              paddingBottom: 6,
            }}
          >
            <span style={{ color: "#7a6f5d" }}>Classe : </span>
            <strong>{cahier.classroom.name}</strong>
          </div>
          <div
            style={{
              borderBottom: "1px solid #b7aa95",
              paddingBottom: 6,
            }}
          >
            <span style={{ color: "#7a6f5d" }}>Période : </span>
            <strong>{cahier.rangeLabel}</strong>
          </div>
        </div>
      </div>

      {/* Corps ligné */}
      <div
        style={{
          position: "relative",
          padding: "8px 28px 28px 0",
          backgroundImage: `repeating-linear-gradient(
            transparent,
            transparent 27px,
            ${line} 27px,
            ${line} 28px
          )`,
          backgroundPosition: "0 8px",
          minHeight: 420,
        }}
      >
        {/* Marge rouge */}
        <div
          style={{
            position: "absolute",
            left: 56,
            top: 0,
            bottom: 0,
            width: 2,
            background: margin,
          }}
        />

        <div style={{ paddingLeft: 72, paddingRight: 8 }}>
          {cahier.sessions.length === 0 ? (
            <p
              style={{
                paddingTop: 36,
                color: "#7a6f5d",
                fontSize: 15,
                fontStyle: "italic",
              }}
            >
              Aucune séance renseignée sur cette période.
            </p>
          ) : (
            cahier.sessions.map((s, index) => (
              <article
                key={s.id}
                style={{
                  paddingTop: index === 0 ? 20 : 28,
                  paddingBottom: 8,
                  pageBreakInside: "avoid",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
                    fontSize: 12,
                    color: "#5f5648",
                    marginBottom: 4,
                  }}
                >
                  <span>
                    <strong style={{ color: ink }}>Date :</strong> {s.date}
                  </span>
                  <span>·</span>
                  <span>
                    <strong style={{ color: ink }}>Horaire :</strong> {s.timeRange}
                  </span>
                  <span>·</span>
                  <span>
                    <strong style={{ color: ink }}>Matière :</strong> {s.subject}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
                    fontSize: 12,
                    color: "#5f5648",
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ color: ink }}>Enseignant :</strong> {s.teacher}
                  {" · "}
                  <strong style={{ color: ink }}>Salle :</strong> {s.room}
                </div>

                <div style={{ fontSize: 16, fontWeight: 700, lineHeight: "28px" }}>
                  {s.title}
                </div>

                {s.content ? (
                  <div style={{ marginTop: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: "28px" }}>
                    {s.content}
                  </div>
                ) : null}

                {s.exercises ? (
                  <div style={{ marginTop: 0, fontSize: 14, lineHeight: "28px" }}>
                    <em>Exercices :</em> {s.exercises}
                  </div>
                ) : null}

                {s.homeworkText ? (
                  <div style={{ marginTop: 0, fontSize: 14, lineHeight: "28px" }}>
                    <em>Devoirs :</em> {s.homeworkText}
                    {s.homeworkDueOn ? ` (remise le ${s.homeworkDueOn})` : ""}
                  </div>
                ) : null}

                {s.observations ? (
                  <div style={{ marginTop: 0, fontSize: 14, lineHeight: "28px" }}>
                    <em>Observations :</em> {s.observations}
                  </div>
                ) : null}

                {s.signatureImage ? (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "flex-end",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
                        fontSize: 11,
                        color: "#5f5648",
                        textAlign: "right",
                      }}
                    >
                      Signature de l’enseignant
                      <br />
                      {s.teacher}
                      {s.validatedAt ? (
                        <>
                          <br />
                          {s.validatedAt}
                        </>
                      ) : null}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.signatureImage}
                      alt="Signature"
                      style={{
                        height: 56,
                        objectFit: "contain",
                        background: "rgba(255,255,255,0.5)",
                        borderBottom: "1px solid #b7aa95",
                        paddingBottom: 2,
                      }}
                    />
                  </div>
                ) : null}

                {index < cahier.sessions.length - 1 ? (
                  <div
                    style={{
                      marginTop: 16,
                      borderBottom: "1px dashed #c9bda8",
                    }}
                  />
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>

      <div
        style={{
          padding: "12px 28px 18px",
          borderTop: "1px solid #d8cfc0",
          fontFamily: '"DM Sans", "Segoe UI", Arial, sans-serif',
          fontSize: 11,
          color: "#7a6f5d",
          textAlign: "center",
        }}
      >
        eCahier · {cahier.classroom.name} · {cahier.periodTitle} ({cahier.rangeLabel}) · Généré le{" "}
        {formatDateLongFr(cahier.generatedAt)}
      </div>
    </div>
  );
}

function AttendanceDocument({ data }: { data: AttendanceData }) {
  return (
    <div
      style={{
        width: 1100,
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily:
          "Segoe UI, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: 28,
      }}
    >
      <div
        style={{
          background: COLORS.greenDark,
          color: COLORS.white,
          borderRadius: 18,
          padding: "22px 24px",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            opacity: 0.8,
          }}
        >
          Liste de présences
        </div>
        <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800 }}>
          {data.classroom.name}
        </div>
        <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
          {data.classroom.schoolName}
          {data.classroom.schoolCity ? ` · ${data.classroom.schoolCity}` : ""}
          {" · "}
          {data.periodTitle} ({data.rangeLabel})
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <Kpi label="Séances" value={data.sessionCount} accent={COLORS.green} />
        <Kpi label="Élèves" value={data.studentCount} accent={COLORS.blue} />
        <Kpi label="Absences" value={data.totals.absent} accent="#c0392b" />
        <Kpi label="Retards" value={data.totals.late} accent={COLORS.orange} />
      </div>

      <Panel title="Détail par élève">
        {data.items.length === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: 14 }}>
            Aucun élève dans cette classe.
          </div>
        ) : data.sessionCount === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: 14 }}>
            Aucune séance sur cette période.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr>
                {[
                  "Élève",
                  "Séances",
                  "Présents",
                  "Absents",
                  "Retards",
                  "Dates d’absence",
                  "Dates de retard",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign:
                        h === "Élève" ||
                        h === "Dates d’absence" ||
                        h === "Dates de retard"
                          ? "left"
                          : "right",
                      padding: "8px 6px",
                      borderBottom: `1px solid ${COLORS.stroke}`,
                      color: COLORS.muted,
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.studentId}>
                  <td
                    style={{
                      padding: "9px 6px",
                      borderBottom: `1px solid ${COLORS.stroke}`,
                      fontWeight: 600,
                      verticalAlign: "top",
                    }}
                  >
                    {row.lastName} {row.firstName}
                  </td>
                  <td
                    style={{
                      padding: "9px 6px",
                      borderBottom: `1px solid ${COLORS.stroke}`,
                      textAlign: "right",
                      verticalAlign: "top",
                    }}
                  >
                    {row.sessions}
                  </td>
                  <td
                    style={{
                      padding: "9px 6px",
                      borderBottom: `1px solid ${COLORS.stroke}`,
                      textAlign: "right",
                      verticalAlign: "top",
                    }}
                  >
                    {row.present}
                  </td>
                  <td
                    style={{
                      padding: "9px 6px",
                      borderBottom: `1px solid ${COLORS.stroke}`,
                      textAlign: "right",
                      color: row.absent > 0 ? "#c0392b" : COLORS.text,
                      fontWeight: row.absent > 0 ? 700 : 400,
                      verticalAlign: "top",
                    }}
                  >
                    {row.absent}
                  </td>
                  <td
                    style={{
                      padding: "9px 6px",
                      borderBottom: `1px solid ${COLORS.stroke}`,
                      textAlign: "right",
                      color: row.late > 0 ? COLORS.orange : COLORS.text,
                      fontWeight: row.late > 0 ? 700 : 400,
                      verticalAlign: "top",
                    }}
                  >
                    {row.late}
                  </td>
                  <td
                    style={{
                      padding: "9px 6px",
                      borderBottom: `1px solid ${COLORS.stroke}`,
                      fontSize: 12,
                      color: COLORS.muted,
                      verticalAlign: "top",
                      maxWidth: 220,
                    }}
                  >
                    {row.absentDates?.length
                      ? row.absentDates.join(" · ")
                      : "—"}
                  </td>
                  <td
                    style={{
                      padding: "9px 6px",
                      borderBottom: `1px solid ${COLORS.stroke}`,
                      fontSize: 12,
                      color: COLORS.muted,
                      verticalAlign: "top",
                      maxWidth: 220,
                    }}
                  >
                    {row.lateDates?.length ? row.lateDates.join(" · ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          color: COLORS.muted,
          textAlign: "center",
        }}
      >
        eCahier · {data.classroom.name} · {data.periodTitle} ({data.rangeLabel}){" "}
        · Généré le {formatDateLongFr(data.generatedAt)}
      </div>
    </div>
  );
}

export function ExportButtons({
  schoolName,
  classrooms,
}: {
  schoolName: string;
  classrooms: { id: string; name: string }[];
}) {
  const [classroomId, setClassroomId] = useState(classrooms[0]?.id || "");
  const [period, setPeriod] = useState<Period>("week");
  const [cahierPeriod, setCahierPeriod] = useState<Period>("week");
  const [attendanceClassroomId, setAttendanceClassroomId] = useState(
    classrooms[0]?.id || "",
  );
  const [attendancePeriod, setAttendancePeriod] =
    useState<AttendancePeriod>("day");
  const [attendanceDate, setAttendanceDate] = useState(todayInputDate());
  const [report, setReport] = useState<ReportData | null>(null);
  const [cahier, setCahier] = useState<CahierData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceData | null>(null);
  const [attendancePreview, setAttendancePreview] =
    useState<AttendanceData | null>(null);
  const [busy, setBusy] = useState<
    | "report-pdf"
    | "report-png"
    | "cahier-pdf"
    | "cahier-png"
    | "attendance-pdf"
    | "attendance-csv"
    | "attendance-view"
    | null
  >(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const cahierRef = useRef<HTMLDivElement>(null);
  const attendanceRef = useRef<HTMLDivElement>(null);

  async function waitForPaint() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  async function downloadNodeAsPdf(
    node: HTMLElement,
    fileName: string,
    backgroundColor: string,
  ) {
    const [{ toPng }, { jsPDF }] = await Promise.all([
      import("html-to-image"),
      import("jspdf"),
    ]);

    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor,
    });

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image PDF impossible à charger"));
      img.src = dataUrl;
    });

    const pdf = new jsPDF({
      orientation: img.width >= img.height ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgWidthMm = usableWidth;
    const imgHeightMm = (img.height * imgWidthMm) / img.width;

    if (imgHeightMm <= usableHeight) {
      pdf.addImage(dataUrl, "PNG", margin, margin, imgWidthMm, imgHeightMm);
    } else {
      let heightLeft = imgHeightMm;
      let position = margin;

      pdf.addImage(dataUrl, "PNG", margin, position, imgWidthMm, imgHeightMm);
      heightLeft -= usableHeight;

      while (heightLeft > 0) {
        position = margin - (imgHeightMm - heightLeft);
        pdf.addPage();
        pdf.addImage(dataUrl, "PNG", margin, position, imgWidthMm, imgHeightMm);
        heightLeft -= usableHeight;
      }
    }

    pdf.save(fileName);
  }

  async function downloadNodeAsPng(
    node: HTMLElement,
    fileName: string,
    backgroundColor: string,
  ) {
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor,
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  async function loadReport() {
    const res = await fetch(`/api/reports/summary?period=${period}`);
    const data = await res.json();
    if (!res.ok || data.message) {
      throw new Error(data.message || "Rapport indisponible");
    }
    flushSync(() => {
      setReport(data);
    });
    await waitForPaint();
    return data as ReportData;
  }

  async function loadCahier() {
    if (!classroomId) throw new Error("Choisissez une classe");
    const res = await fetch(
      `/api/reports/cahier?classroomId=${classroomId}&period=${cahierPeriod}`,
    );
    const data = await res.json();
    if (!res.ok || data.message) {
      throw new Error(data.message || "Cahier indisponible");
    }
    flushSync(() => {
      setCahier(data);
    });
    await waitForPaint();
    return data as CahierData;
  }

  async function loadAttendance() {
    if (!attendanceClassroomId) throw new Error("Choisissez une classe");
    const params = new URLSearchParams({
      classroomId: attendanceClassroomId,
      period: attendancePeriod,
    });
    if (attendancePeriod === "day") {
      params.set("date", attendanceDate);
    }
    const res = await fetch(`/api/reports/attendance?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || data.message) {
      throw new Error(data.message || "Rapport de présences indisponible");
    }
    flushSync(() => {
      setAttendance(data);
    });
    await waitForPaint();
    return data as AttendanceData;
  }

  async function downloadReportPdf() {
    setBusy("report-pdf");
    try {
      await loadReport();
      if (!reportRef.current) throw new Error("Rendu rapport indisponible");
      await downloadNodeAsPdf(
        reportRef.current,
        `rapport-${period}-${new Date().toISOString().slice(0, 10)}.pdf`,
        COLORS.bg,
      );
    } catch (error) {
      console.error(error);
      window.alert("Impossible de générer le PDF. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadImage() {
    setBusy("report-png");
    try {
      await loadReport();
      if (!reportRef.current) throw new Error("Rendu rapport indisponible");
      await downloadNodeAsPng(
        reportRef.current,
        `rapport-${period}-${new Date().toISOString().slice(0, 10)}.png`,
        COLORS.bg,
      );
    } catch (error) {
      console.error(error);
      window.alert("Impossible de générer l’image. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadCahierPdf() {
    setBusy("cahier-pdf");
    try {
      const data = await loadCahier();
      if (!cahierRef.current) throw new Error("Rendu cahier indisponible");
      await downloadNodeAsPdf(
        cahierRef.current,
        `cahier-${data.classroom.name.replace(/\s+/g, "-").toLowerCase()}-${data.period}-${new Date().toISOString().slice(0, 10)}.pdf`,
        "#fbf7ef",
      );
    } catch (error) {
      console.error(error);
      window.alert("Impossible de générer le PDF. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadCahierImage() {
    setBusy("cahier-png");
    try {
      const data = await loadCahier();
      if (!cahierRef.current) throw new Error("Rendu cahier indisponible");
      await downloadNodeAsPng(
        cahierRef.current,
        `cahier-${data.classroom.name.replace(/\s+/g, "-").toLowerCase()}-${data.period}-${new Date().toISOString().slice(0, 10)}.png`,
        "#fbf7ef",
      );
    } catch (error) {
      console.error(error);
      window.alert("Impossible de générer l’image. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadAttendancePdf() {
    setBusy("attendance-pdf");
    try {
      const data = await loadAttendance();
      if (!attendanceRef.current) throw new Error("Rendu présences indisponible");
      await downloadNodeAsPdf(
        attendanceRef.current,
        `presences-${data.classroom.name.replace(/\s+/g, "-").toLowerCase()}-${data.period}-${new Date().toISOString().slice(0, 10)}.pdf`,
        COLORS.bg,
      );
    } catch (error) {
      console.error(error);
      window.alert("Impossible de générer le PDF. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadAttendanceCsv() {
    setBusy("attendance-csv");
    try {
      const data = await loadAttendance();
      const header = [
        "Nom",
        "Prénom",
        "Séances",
        "Présents",
        "Absents",
        "Retards",
        "Dates d'absence",
        "Dates de retard",
      ];
      const lines = [
        header.join(";"),
        ...data.items.map((row) =>
          [
            row.lastName,
            row.firstName,
            row.sessions,
            row.present,
            row.absent,
            row.late,
            (row.absentDates || []).join(" | "),
            (row.lateDates || []).join(" | "),
          ]
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(";"),
        ),
      ];
      const bom = "\uFEFF";
      const blob = new Blob([bom + lines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `presences-${data.classroom.name.replace(/\s+/g, "-").toLowerCase()}-${data.period}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      window.alert("Impossible de générer le CSV. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  async function viewAttendance() {
    setBusy("attendance-view");
    try {
      const data = await loadAttendance();
      setAttendancePreview(data);
    } catch (error) {
      console.error(error);
      window.alert("Impossible de charger le rapport. Réessayez.");
      setAttendancePreview(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="no-print grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--bg)] p-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[var(--brand-ink)]">
              Rapport de direction
            </h2>
          </div>

          <Field label="Période">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="week">Rapport hebdomadaire</option>
              <option value="month">Rapport mensuel</option>
              <option value="year">Rapport annuel</option>
            </Select>
          </Field>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={downloadReportPdf} disabled={busy !== null}>
              {busy === "report-pdf" ? "Préparation PDF..." : "Exporter en PDF"}
            </Button>
            <Button variant="secondary" onClick={downloadImage} disabled={busy !== null}>
              {busy === "report-png" ? "Préparation..." : "Exporter en image"}
            </Button>
          </div>
        </div>

        <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--bg)] p-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[var(--brand-ink)]">
              Cahier de textes
            </h2>
          </div>

          <Field label="Classe">
            <Select value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Période">
            <Select
              value={cahierPeriod}
              onChange={(e) => setCahierPeriod(e.target.value as Period)}
            >
              <option value="week">Semaine en cours</option>
              <option value="month">Mois en cours</option>
              <option value="year">Année en cours</option>
            </Select>
          </Field>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={downloadCahierPdf} disabled={!classroomId || busy !== null}>
              {busy === "cahier-pdf" ? "Préparation PDF..." : "Exporter en PDF"}
            </Button>
            <Button
              variant="secondary"
              onClick={downloadCahierImage}
              disabled={!classroomId || busy !== null}
            >
              {busy === "cahier-png" ? "Préparation..." : "Exporter en image"}
            </Button>
          </div>
        </div>

        <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--bg)] p-4 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[var(--brand-ink)]">
              Liste de présences
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Classe" className="mb-0">
              <Select
                value={attendanceClassroomId}
                onChange={(e) => {
                  setAttendanceClassroomId(e.target.value);
                  setAttendancePreview(null);
                }}
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Période" className="mb-0">
              <Select
                value={attendancePeriod}
                onChange={(e) => {
                  setAttendancePeriod(e.target.value as AttendancePeriod);
                  setAttendancePreview(null);
                }}
              >
                <option value="day">Jour</option>
                <option value="week">Semaine en cours</option>
                <option value="month">Mois en cours</option>
                <option value="year">Année en cours</option>
              </Select>
            </Field>

            {attendancePeriod === "day" ? (
              <Field label="Date" className="mb-0 sm:col-span-2">
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => {
                    setAttendanceDate(e.target.value);
                    setAttendancePreview(null);
                  }}
                />
              </Field>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {attendancePeriod === "day" ? (
              <Button
                onClick={viewAttendance}
                disabled={!attendanceClassroomId || busy !== null}
              >
                {busy === "attendance-view" ? "Chargement…" : "Afficher"}
              </Button>
            ) : (
              <>
                <Button
                  onClick={downloadAttendancePdf}
                  disabled={!attendanceClassroomId || busy !== null}
                >
                  {busy === "attendance-pdf"
                    ? "Préparation PDF..."
                    : "Exporter en PDF"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={downloadAttendanceCsv}
                  disabled={!attendanceClassroomId || busy !== null}
                >
                  {busy === "attendance-csv"
                    ? "Préparation..."
                    : "Exporter CSV"}
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {attendancePreview && attendancePreview.period === "day" ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setAttendancePreview(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Liste de présences"
            className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <h2 className="m-0 text-base font-semibold text-[var(--brand-ink)]">
                  Liste de présences
                </h2>
                <p className="m-0 mt-0.5 text-sm text-[var(--muted)]">
                  {attendancePreview.classroom.name} ·{" "}
                  {attendancePreview.rangeLabel}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--bg)] hover:text-[var(--text)]"
                aria-label="Fermer"
                onClick={() => setAttendancePreview(null)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4 sm:px-5">
              {!attendancePreview.dayRows?.length ? (
                <p className="text-sm text-[var(--muted)]">
                  {attendancePreview.studentCount === 0
                    ? "Aucun élève dans cette classe."
                    : "Aucune séance ce jour-là."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--stroke)] text-xs uppercase tracking-wide text-[var(--muted)]">
                        <th className="py-2 pr-3 font-semibold">Élève</th>
                        <th className="px-2 py-2 font-semibold">Matière</th>
                        <th className="px-2 py-2 font-semibold">Horaire</th>
                        <th className="py-2 pl-2 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--stroke)]">
                      {attendancePreview.dayRows.map((row) => (
                        <tr key={`${row.sessionId}-${row.studentId}`}>
                          <td className="py-2.5 pr-3 font-medium">
                            {row.lastName} {row.firstName}
                          </td>
                          <td className="px-2 py-2.5">{row.subject}</td>
                          <td className="px-2 py-2.5 tabular-nums text-[var(--muted)]">
                            {row.timeRange}
                          </td>
                          <td className="py-2.5 pl-2">
                            <span
                              className={
                                row.status === "absent"
                                  ? "font-semibold text-[var(--danger)]"
                                  : row.status === "late"
                                    ? "font-semibold text-[var(--warn)]"
                                    : "font-semibold text-[var(--ok)]"
                              }
                            >
                              {statusLabel(row.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute"
        style={{ left: -10000, top: 0 }}
        aria-hidden
      >
        {report ? (
          <div ref={reportRef}>
            <ReportDocument report={report} schoolName={schoolName} />
          </div>
        ) : null}
        {cahier ? (
          <div ref={cahierRef}>
            <CahierDocument cahier={cahier} />
          </div>
        ) : null}
        {attendance ? (
          <div ref={attendanceRef}>
            <AttendanceDocument data={attendance} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

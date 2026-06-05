import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import * as XLSX from "xlsx";

const BACKEND = window.location.origin;

const DEFAULT_MESSAGE = `Hi {Name}! 👋

This is a gentle reminder from our team that there is an outstanding amount of ₹{Outstanding Amount} pending on your account.

Kindly arrange the payment at your earliest convenience.

Thank you! 🙏`;

// ── Utility ──────────────────────────────────────────────────────────────────
function parseMessage(template, row) {
  return template
    .replace(/\{Name\}/gi, row?.Name || "{Name}")
    .replace(/\{Outstanding Amount\}/gi, row?.["Outstanding Amount"] || "{Outstanding Amount}");
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ["Upload", "Message", "Connect", "Send"];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 40 }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: done ? "#25d366" : active ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.05)",
                border: `2px solid ${done ? "#25d366" : active ? "#25d366" : "rgba(255,255,255,0.1)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: "bold",
                color: done ? "#0a0a0a" : active ? "#25d366" : "#444",
                transition: "all 0.3s",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, color: active ? "#25d366" : done ? "#4caf50" : "#444", letterSpacing: 1 }}>{s.toUpperCase()}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 60, height: 2, background: done ? "#25d366" : "rgba(255,255,255,0.08)", margin: "0 8px", marginBottom: 22, transition: "all 0.3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(37,211,102,0.15)",
      borderRadius: 16, padding: 28,
      backdropFilter: "blur(10px)",
      ...style
    }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", style = {} }) {
  const base = {
    padding: "12px 28px", borderRadius: 10, border: "none",
    fontFamily: "'DM Mono', monospace", fontWeight: "bold",
    fontSize: 13, letterSpacing: 1, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1, transition: "all 0.2s", ...style
  };
  const variants = {
    primary: { background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff" },
    outline: { background: "transparent", border: "1px solid rgba(37,211,102,0.4)", color: "#25d366" },
    danger: { background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", color: "#ff5050" },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

// ── STEP 1: Upload ────────────────────────────────────────────────────────────
function StepUpload({ onNext, socketId }) {
  const [drag, setDrag] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const processFile = async (file) => {
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("socketId", socketId);
    try {
      const res = await fetch(`${BACKEND}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setContacts(data.preview);
      setFileName(file.name);
      onNext(data);
    } catch (e) {
      setError(e.message || "Failed to parse file");
    }
    setLoading(false);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [socketId]);

  return (
    <div>
      <h2 style={{ color: "#25d366", fontSize: 22, marginBottom: 6, fontWeight: 700 }}>Upload Contacts</h2>
      <p style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>Excel file with Name, Phone, Outstanding Amount columns</p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        style={{
          border: `2px dashed ${drag ? "#25d366" : "rgba(37,211,102,0.25)"}`,
          borderRadius: 14, padding: "52px 32px", textAlign: "center",
          background: drag ? "rgba(37,211,102,0.04)" : "rgba(0,0,0,0.2)",
          transition: "all 0.2s", cursor: "pointer",
          boxShadow: drag ? "0 0 40px rgba(37,211,102,0.1)" : "none",
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>📊</div>
        <div style={{ color: "#bbb", fontSize: 15, marginBottom: 6 }}>Drop your Excel file here</div>
        <div style={{ color: "#444", fontSize: 12, marginBottom: 20 }}>Supports .xlsx and .xls</div>
        <label style={{
          background: "linear-gradient(135deg,#25d366,#128c7e)",
          color: "#fff", padding: "10px 24px", borderRadius: 8,
          cursor: "pointer", fontSize: 13, fontWeight: "bold", letterSpacing: 1
        }}>
          {loading ? "Processing..." : "📂 Browse File"}
          <input type="file" accept=".xlsx,.xls" onChange={e => e.target.files[0] && processFile(e.target.files[0])} style={{ display: "none" }} />
        </label>
        {fileName && <div style={{ marginTop: 14, color: "#4caf50", fontSize: 13 }}>✅ {fileName}</div>}
        {error && <div style={{ marginTop: 14, color: "#ff6b6b", fontSize: 13 }}>❌ {error}</div>}
      </div>

      <div style={{ marginTop: 24, background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 18, border: "1px solid rgba(37,211,102,0.1)" }}>
        <div style={{ color: "#25d366", fontSize: 11, fontWeight: "bold", letterSpacing: 2, marginBottom: 12 }}>REQUIRED FORMAT</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>{["Name", "Phone", "Outstanding Amount"].map(h => (
              <th key={h} style={{ background: "rgba(37,211,102,0.1)", padding: "7px 12px", textAlign: "left", color: "#25d366", border: "1px solid rgba(37,211,102,0.15)" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {[["Ravi Kumar", "919876543210", "5000"], ["Priya Shah", "918765432109", "12000"]].map((r, i) => (
              <tr key={i}>{r.map((c, j) => (
                <td key={j} style={{ padding: "7px 12px", border: "1px solid rgba(255,255,255,0.05)", color: "#888" }}>{c}</td>
              ))}</tr>
            ))}
          </tbody>
        </table>
        <div style={{ color: "#444", fontSize: 11, marginTop: 8 }}>⚠️ Phone: country code + 10 digits, no spaces or +</div>
      </div>
    </div>
  );
}

// ── STEP 2: Message ───────────────────────────────────────────────────────────
function StepMessage({ uploadData, onNext, onBack, socketId }) {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [previewIndex, setPreviewIndex] = useState(0);
  const contacts = uploadData?.preview || [];

  const save = async () => {
    await fetch(`${BACKEND}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socketId, message })
    });
    onNext(message);
  };

  return (
    <div>
      <h2 style={{ color: "#25d366", fontSize: 22, marginBottom: 6, fontWeight: 700 }}>Craft Your Message</h2>
      <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>Use <span style={{ color: "#25d366" }}>{"{Name}"}</span> and <span style={{ color: "#25d366" }}>{"{Outstanding Amount}"}</span> as placeholders</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Editor */}
        <div>
          <div style={{ color: "#666", fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>MESSAGE TEMPLATE</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {["{Name}", "{Outstanding Amount}"].map(tag => (
              <button key={tag} onClick={() => setMessage(m => m + tag)}
                style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25d366", padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontSize: 12 }}>
                + {tag}
              </button>
            ))}
          </div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={12}
            style={{
              width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(37,211,102,0.2)",
              borderRadius: 10, color: "#ddd", padding: 14, fontSize: 13,
              fontFamily: "'DM Mono', monospace", lineHeight: 1.7, resize: "vertical",
              outline: "none", boxSizing: "border-box"
            }} />
        </div>

        {/* Live Preview */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ color: "#666", fontSize: 11, letterSpacing: 2 }}>LIVE PREVIEW</div>
            {contacts.length > 0 && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                  style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#25d366", padding: "3px 10px", borderRadius: 6, cursor: "pointer" }}>←</button>
                <span style={{ color: "#555", fontSize: 11 }}>{previewIndex + 1}/{contacts.length}</span>
                <button onClick={() => setPreviewIndex(Math.min(contacts.length - 1, previewIndex + 1))}
                  style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)", color: "#25d366", padding: "3px 10px", borderRadius: 6, cursor: "pointer" }}>→</button>
              </div>
            )}
          </div>

          {/* WhatsApp-style bubble */}
          <div style={{
            background: "linear-gradient(180deg,#0b1a10,#071009)", borderRadius: 12,
            padding: 16, minHeight: 280, position: "relative", overflow: "hidden",
            border: "1px solid rgba(37,211,102,0.1)"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "rgba(37,211,102,0.08)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderRadius: "12px 12px 0 0" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#25d366,#128c7e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>👤</div>
              <div>
                <div style={{ color: "#25d366", fontSize: 12, fontWeight: "bold" }}>{contacts[previewIndex]?.Name || "Contact"}</div>
                <div style={{ color: "#4caf50", fontSize: 10 }}>online</div>
              </div>
            </div>
            <div style={{ marginTop: 56, padding: "0 4px" }}>
              <div style={{
                background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.15)",
                borderRadius: "12px 12px 12px 2px", padding: 12, maxWidth: "85%",
                fontSize: 13, lineHeight: 1.7, color: "#ccc", whiteSpace: "pre-wrap"
              }}>
                {parseMessage(message, contacts[previewIndex])}
              </div>
              <div style={{ color: "#333", fontSize: 10, marginTop: 4, paddingLeft: 4 }}>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Btn onClick={onBack} variant="outline">← Back</Btn>
        <Btn onClick={save}>Continue →</Btn>
      </div>
    </div>
  );
}

// ── STEP 3: Connect WhatsApp ──────────────────────────────────────────────────
function StepConnect({ onNext, onBack, waStatus, qrImage }) {
  if (waStatus === "ready") {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: "#25d366", fontSize: 24, marginBottom: 8 }}>WhatsApp Connected!</h2>
        <p style={{ color: "#666", marginBottom: 32 }}>Your device is linked and ready to send messages</p>
        <Btn onClick={onNext}>Start Sending →</Btn>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color: "#25d366", fontSize: 22, marginBottom: 6, fontWeight: 700 }}>Link WhatsApp</h2>
      <p style={{ color: "#555", fontSize: 13, marginBottom: 28 }}>Scan the QR code with your phone to connect</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* QR */}
        <div style={{ textAlign: "center" }}>
          <div style={{
            background: "rgba(255,255,255,0.97)", borderRadius: 16, padding: 16,
            display: "inline-block", boxShadow: "0 0 40px rgba(37,211,102,0.2)"
          }}>
            {qrImage ? (
              <img src={qrImage} alt="QR Code" style={{ width: 220, height: 220, display: "block" }} />
            ) : (
              <div style={{
                width: 220, height: 220, background: "#f0f0f0", borderRadius: 8,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12
              }}>
                {waStatus === "authenticated" ? (
                  <>
                    <div style={{ fontSize: 32 }}>🔄</div>
                    <div style={{ color: "#666", fontSize: 12 }}>Loading...</div>
                  </>
                ) : (
                  <>
                    <div style={{ width: 32, height: 32, border: "3px solid #25d366", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                    <div style={{ color: "#999", fontSize: 12 }}>Generating QR...</div>
                  </>
                )}
              </div>
            )}
          </div>
          {waStatus === "authenticated" && (
            <div style={{ marginTop: 12, color: "#25d366", fontSize: 13 }}>🔄 Authenticating...</div>
          )}
        </div>

        {/* Instructions */}
        <div>
          <div style={{ color: "#666", fontSize: 11, letterSpacing: 2, marginBottom: 16 }}>HOW TO SCAN</div>
          {[
            { n: "1", t: "Open WhatsApp", d: "On your phone" },
            { n: "2", t: "Go to Settings", d: "Tap the three dots (⋮) menu" },
            { n: "3", t: "Linked Devices", d: "Tap 'Link a Device'" },
            { n: "4", t: "Scan QR Code", d: "Point your camera at the code" },
          ].map(step => (
            <div key={step.n} style={{ display: "flex", gap: 14, marginBottom: 18, alignItems: "flex-start" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", minWidth: 28,
                background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#25d366", fontSize: 12, fontWeight: "bold"
              }}>{step.n}</div>
              <div>
                <div style={{ color: "#ccc", fontSize: 13, fontWeight: "bold" }}>{step.t}</div>
                <div style={{ color: "#555", fontSize: 12 }}>{step.d}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8, padding: 12, background: "rgba(255,200,0,0.05)", border: "1px solid rgba(255,200,0,0.15)", borderRadius: 8 }}>
            <div style={{ color: "#ffc107", fontSize: 12 }}>⚠️ QR expires in ~20 seconds. If it expires, refresh the page.</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Btn onClick={onBack} variant="outline">← Back</Btn>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── STEP 4: Send ──────────────────────────────────────────────────────────────
function StepSend({ uploadData, socketId, onReset }) {
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(null);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(null);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const startSending = async () => {
    setSending(true);
    setStarted(true);
    setLog([]);
    setDone(null);

    const res = await fetch(`${BACKEND}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socketId })
    });
    const data = await res.json();
    if (!data.started) {
      setLog([{ name: "Error", status: "failed", msg: data.error }]);
      setSending(false);
    }
  };

  // Listen for progress via socket (passed as prop would need prop drilling; use window event bus)
  useEffect(() => {
    const onProgress = (e) => {
      const d = e.detail;
      setProgress(d);
      setLog(prev => [...prev, { name: d.name, phone: d.phone, status: d.status }]);
    };
    const onDone = (e) => {
      setDone(e.detail);
      setSending(false);
    };
    window.addEventListener("wa_progress", onProgress);
    window.addEventListener("wa_done", onDone);
    return () => {
      window.removeEventListener("wa_progress", onProgress);
      window.removeEventListener("wa_done", onDone);
    };
  }, []);

  const pct = progress ? Math.round((progress.index / progress.total) * 100) : 0;

  return (
    <div>
      <h2 style={{ color: "#25d366", fontSize: 22, marginBottom: 6, fontWeight: 700 }}>Send Messages</h2>
      <p style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>
        {uploadData?.count} contacts loaded · ~4.5s between messages
      </p>

      {!started ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🚀</div>
          <div style={{ color: "#ccc", fontSize: 16, marginBottom: 8 }}>Ready to send to {uploadData?.count} contacts</div>
          <div style={{ color: "#555", fontSize: 13, marginBottom: 28 }}>
            Estimated time: ~{Math.ceil((uploadData?.count * 4.5) / 60)} minutes
          </div>
          <Btn onClick={startSending} style={{ fontSize: 15, padding: "14px 36px" }}>
            ▶ Start Sending
          </Btn>
        </Card>
      ) : (
        <>
          {/* Progress bar */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: "#ccc", fontSize: 13 }}>
                {done ? "Complete!" : sending ? `Sending ${progress?.index || 0} of ${progress?.total || uploadData?.count}...` : "Starting..."}
              </span>
              <span style={{ color: "#25d366", fontWeight: "bold", fontSize: 13 }}>{pct}%</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, height: 10, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 8, width: `${pct}%`,
                background: "linear-gradient(90deg,#25d366,#128c7e)",
                transition: "width 0.5s ease", boxShadow: "0 0 10px rgba(37,211,102,0.4)"
              }} />
            </div>
            {progress && (
              <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
                <span style={{ color: "#4caf50", fontSize: 12 }}>✅ Success: {progress.success}</span>
                <span style={{ color: "#ff6b6b", fontSize: 12 }}>❌ Failed: {progress.failed}</span>
              </div>
            )}
          </Card>

          {/* Log */}
          <Card>
            <div style={{ color: "#666", fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>ACTIVITY LOG</div>
            <div ref={logRef} style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {log.map((entry, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 12px", borderRadius: 8,
                  background: entry.status === "success" ? "rgba(37,211,102,0.06)" : "rgba(255,80,80,0.06)",
                  border: `1px solid ${entry.status === "success" ? "rgba(37,211,102,0.12)" : "rgba(255,80,80,0.12)"}`,
                }}>
                  <span style={{ fontSize: 14 }}>{entry.status === "success" ? "✅" : "❌"}</span>
                  <span style={{ color: "#ccc", fontSize: 13, flex: 1 }}>{entry.name}</span>
                  <span style={{ color: "#444", fontSize: 11 }}>{entry.phone}</span>
                </div>
              ))}
              {log.length === 0 && <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: 20 }}>Waiting to start...</div>}
            </div>
          </Card>

          {/* Done state */}
          {done && (
            <Card style={{ marginTop: 20, textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <div style={{ color: "#25d366", fontSize: 20, fontWeight: "bold", marginBottom: 8 }}>All Done!</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 24 }}>
                <div><div style={{ color: "#4caf50", fontSize: 28, fontWeight: "bold" }}>{done.success}</div><div style={{ color: "#555", fontSize: 12 }}>Sent</div></div>
                <div><div style={{ color: "#ff6b6b", fontSize: 28, fontWeight: "bold" }}>{done.failed}</div><div style={{ color: "#555", fontSize: 12 }}>Failed</div></div>
                <div><div style={{ color: "#ccc", fontSize: 28, fontWeight: "bold" }}>{done.total}</div><div style={{ color: "#555", fontSize: 12 }}>Total</div></div>
              </div>
              <Btn onClick={onReset} variant="outline">Send Another Batch</Btn>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(0);
  const [socketId, setSocketId] = useState(null);
  const [uploadData, setUploadData] = useState(null);
  const [waStatus, setWaStatus] = useState("init"); // init | qr | authenticated | ready | disconnected
  const [qrImage, setQrImage] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(BACKEND);
    socketRef.current = socket;

    socket.on("connect", () => setSocketId(socket.id));

    socket.on("qr", (dataUrl) => {
      setQrImage(dataUrl);
      setWaStatus("qr");
    });

    socket.on("wa_authenticated", () => {
      setWaStatus("authenticated");
      setQrImage(null);
    });

    socket.on("wa_ready", () => {
      setWaStatus("ready");
    });

    socket.on("wa_disconnected", () => {
      setWaStatus("disconnected");
    });

    socket.on("progress", (data) => {
      window.dispatchEvent(new CustomEvent("wa_progress", { detail: data }));
    });

    socket.on("done", (data) => {
      window.dispatchEvent(new CustomEvent("wa_done", { detail: data }));
    });

    return () => socket.disconnect();
  }, []);

  const reset = () => {
    setStep(0);
    setUploadData(null);
    setQrImage(null);
    setWaStatus(waStatus === "ready" ? "ready" : "init");
    if (socketRef.current) socketRef.current.emit("restart_wa");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080d09",
      backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(37,211,102,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(18,140,126,0.04) 0%, transparent 60%)",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      color: "#e8f5e9",
      padding: "40px 20px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 14,
          background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.2)",
          borderRadius: 14, padding: "14px 28px", marginBottom: 8
        }}>
          <span style={{ fontSize: 28 }}>💬</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 20, fontWeight: "bold", color: "#25d366", letterSpacing: 2 }}>WHATSAPP BLAST</div>
            <div style={{ fontSize: 10, color: "#4caf50", opacity: 0.6, letterSpacing: 3 }}>BULK MESSAGING PLATFORM</div>
          </div>
        </div>

        {/* Connection badge */}
        <div style={{ marginTop: 10 }}>
          <span style={{
            fontSize: 11, padding: "4px 12px", borderRadius: 20, letterSpacing: 1,
            background: waStatus === "ready" ? "rgba(37,211,102,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${waStatus === "ready" ? "rgba(37,211,102,0.3)" : "rgba(255,255,255,0.08)"}`,
            color: waStatus === "ready" ? "#25d366" : "#555"
          }}>
            {waStatus === "ready" ? "● WHATSAPP CONNECTED" : waStatus === "qr" ? "○ SCAN QR CODE" : waStatus === "authenticated" ? "○ AUTHENTICATING..." : "○ CONNECTING..."}
          </span>
        </div>
      </div>

      {/* Main card */}
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Steps current={step} />

        <Card>
          {step === 0 && (
            <StepUpload
              socketId={socketId}
              onNext={(data) => { setUploadData(data); setStep(1); }}
            />
          )}
          {step === 1 && (
            <StepMessage
              uploadData={uploadData}
              socketId={socketId}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepConnect
              waStatus={waStatus}
              qrImage={qrImage}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepSend
              uploadData={uploadData}
              socketId={socketId}
              onReset={reset}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

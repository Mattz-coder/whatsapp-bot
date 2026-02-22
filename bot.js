// ================= IMPORTS =================
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")
const fs = require("fs")
const XLSX = require("xlsx")
const PDFDocument = require("pdfkit")

// ================= CONFIG =================
const OWNER = "5541988972311@s.whatsapp.net"
let prof = "mattheus"
let escola = "anesio"

// ================= UTIL =================
function dir(path) {
    if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true })
}

function caminho(tipo) {
    const base = `dados/${prof}/${escola}`
    dir(base)
    return `${base}/${tipo}.xlsx`
}

function ler(file) {
    if (!fs.existsSync(file)) {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet([])
        XLSX.utils.book_append_sheet(wb, ws, "Dados")
        XLSX.writeFile(wb, file)
    }
    const wb = XLSX.readFile(file)
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
}

function salvar(file, dados) {
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Dados")
    XLSX.writeFile(wb, file)
}

function hoje() {
    return new Date().toLocaleDateString()
}

// ================= BOT =================
async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth")
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async ({ connection, qr }) => {
        if (qr) console.log(await QRCode.toDataURL(qr))
        if (connection === "open") console.log("Sistema Escolar V1 ONLINE")
        if (connection === "close") startBot()
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0]
        if (!msg.message) return
        if (msg.key.remoteJid !== OWNER) return

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ""

        if (!text.startsWith("!")) return

        const p = text.split(" ")

        // ===== PERFIL =====
        if (p[0] === "!prof") {
            prof = p[1]
            return sock.sendMessage(OWNER, { text: `Professor ativo: ${prof}` })
        }

        // ===== ESCOLA =====
        if (p[0] === "!escola") {
            escola = p[1]
            return sock.sendMessage(OWNER, { text: `Escola ativa: ${escola}` })
        }

        const acad = caminho("academico")
        const disc = caminho("disciplinar")

        // ===== PRESENÇA =====
        if (p[0] === "!presente" || p[0] === "!falta") {
            const dados = ler(acad)
            dados.push({
                Data: hoje(),
                Serie: p[1],
                Aluno: p.slice(2).join(" "),
                Presenca: p[0] === "!presente" ? "✔" : "❌",
                Tarefa: "",
                Conteudo: "",
                Obs: ""
            })
            salvar(acad, dados)
            return sock.sendMessage(OWNER, { text: "Presença registrada" })
        }

        // ===== TAREFA =====
        if (p[0] === "!fez" || p[0] === "!naofez") {
            const dados = ler(acad)
            dados.push({
                Data: hoje(),
                Serie: p[1],
                Aluno: p.slice(2).join(" "),
                Presenca: "",
                Tarefa: p[0] === "!fez" ? "✔" : "❌",
                Conteudo: "",
                Obs: ""
            })
            salvar(acad, dados)
            return sock.sendMessage(OWNER, { text: "Tarefa registrada" })
        }

        // ===== CONTEÚDO =====
        if (p[0] === "!conteudo") {
            const dados = ler(acad)
            dados.push({
                Data: hoje(),
                Serie: "",
                Aluno: "",
                Presenca: "",
                Tarefa: "",
                Conteudo: p.slice(1).join(" "),
                Obs: ""
            })
            salvar(acad, dados)
            return sock.sendMessage(OWNER, { text: "Conteúdo registrado" })
        }

        // ===== DISCIPLINAR =====
        if (p[0] === "!disciplina") {
            const dados = ler(disc)
            dados.push({
                Data: hoje(),
                Serie: p[1],
                Aluno: p[2],
                Tipo: p[3],
                Descricao: p.slice(4).join(" ")
            })
            salvar(disc, dados)
            return sock.sendMessage(OWNER, { text: "Registro disciplinar salvo" })
        }

    })
}

startBot()

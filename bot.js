const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")
const fs = require("fs")

// ================= CONFIG =================
const DONO = "5541988972311"
let professor = "mattheus"
let escola = "anesio"

// ================= UTIL =================
function pastaBase() {
    const dir = `dados/${professor}/${escola}`
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
}

function arquivo(tipo) {
    return `${pastaBase()}/${tipo}.json`
}

function ler(tipo) {
    const path = arquivo(tipo)
    if (!fs.existsSync(path)) fs.writeFileSync(path, JSON.stringify([]))
    return JSON.parse(fs.readFileSync(path))
}

function salvar(tipo, dados) {
    fs.writeFileSync(arquivo(tipo), JSON.stringify(dados, null, 2))
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
        if (msg.message.protocolMessage) return

        const jid = msg.key.remoteJid
        if (!jid.includes(DONO)) return

        const m = msg.message
        const text =
            m.conversation ||
            m.extendedTextMessage?.text ||
            m.ephemeralMessage?.message?.conversation ||
            m.ephemeralMessage?.message?.extendedTextMessage?.text ||
            ""

        if (!text || !text.startsWith("!")) return

        const p = text.trim().split(" ")

        // ================= PROFESSOR =================
        if (p[0] === "!prof") {
            professor = p[1]
            return sock.sendMessage(jid, { text: `Professor ativo: ${professor}` })
        }

        // ================= ESCOLA =================
        if (p[0] === "!escola") {
            escola = p[1]
            return sock.sendMessage(jid, { text: `Escola ativa: ${escola}` })
        }

        // ================= PRESENÇA =================
        if (p[0] === "!presente" || p[0] === "!falta") {

            const dados = ler("academico")

            dados.push({
                data: hoje(),
                serie: p[1],
                aluno: p.slice(2).join(" "),
                presenca: p[0] === "!presente" ? "✔" : "❌",
                tarefa: "",
                conteudo: ""
            })

            salvar("academico", dados)

            return sock.sendMessage(jid, { text: "Presença registrada ✅" })
        }

        // ================= TAREFA =================
        if (p[0] === "!fez" || p[0] === "!naofez") {

            const dados = ler("academico")

            dados.push({
                data: hoje(),
                serie: p[1],
                aluno: p.slice(2).join(" "),
                presenca: "",
                tarefa: p[0] === "!fez" ? "✔" : "❌",
                conteudo: ""
            })

            salvar("academico", dados)

            return sock.sendMessage(jid, { text: "Tarefa registrada ✅" })
        }

        // ================= CONTEÚDO =================
        if (p[0] === "!conteudo") {

            const dados = ler("academico")

            dados.push({
                data: hoje(),
                serie: "",
                aluno: "",
                presenca: "",
                tarefa: "",
                conteudo: p.slice(1).join(" ")
            })

            salvar("academico", dados)

            return sock.sendMessage(jid, { text: "Conteúdo registrado 📘" })
        }

        // ================= DISCIPLINAR =================
        if (p[0] === "!disciplina") {

            const dados = ler("disciplinar")

            dados.push({
                data: hoje(),
                serie: p[1],
                aluno: p[2],
                tipo: p[3],
                descricao: p.slice(4).join(" ")
            })

            salvar("disciplinar", dados)

            return sock.sendMessage(jid, { text: "Registro disciplinar salvo 🚨" })
        }

    })
}

startBot()

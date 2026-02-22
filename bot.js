const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")
const fs = require("fs")
const XLSX = require("xlsx")
const PDFDocument = require("pdfkit")

// ================= CONFIG =================
const PLANILHA = "registros.xlsx"
const BACKUP_DIR = "backup"
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR)

// ================= PLANILHA =================
function garantirPlanilha() {
    if (!fs.existsSync(PLANILHA)) {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet([])
        XLSX.utils.book_append_sheet(wb, ws, "Dados")
        XLSX.writeFile(wb, PLANILHA)
    }
}

function lerPlanilha() {
    garantirPlanilha()
    const workbook = XLSX.readFile(PLANILHA)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    return XLSX.utils.sheet_to_json(sheet)
}

function salvarPlanilha(dados) {
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Dados")
    XLSX.writeFile(wb, PLANILHA)
}

function backupAutomatico() {
    const data = new Date().toISOString().replace(/[:.]/g, "-")
    const backupFile = `${BACKUP_DIR}/backup-${data}.xlsx`
    fs.copyFileSync(PLANILHA, backupFile)
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
        if (qr) {
            const qrBase64 = await QRCode.toDataURL(qr)
            console.log("\nAbra no navegador:\n")
            console.log(qrBase64)
        }

        if (connection === "open") console.log("BOT ONLINE 🚀")
        if (connection === "close") startBot()
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0]
        if (!msg.message) return

        const from = msg.key.remoteJid
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            ""

        const command = text.toLowerCase().trim()

        if (!command.startsWith("!")) return

        // ================= ADD =================
        if (command.startsWith("!add")) {

            const partes = text.split(" ")

            if (partes.length < 4)
                return await sock.sendMessage(from, { text: "Use: !add Nome Valor Observacao" })

            const nome = partes[1]
            const valor = partes[2]
            const obs = partes.slice(3).join(" ")

            const dados = lerPlanilha()

            dados.push({
                ID: Date.now(),
                Nome: nome,
                Valor: valor,
                Observacao: obs,
                Data: new Date().toLocaleString()
            })

            salvarPlanilha(dados)
            backupAutomatico()

            await sock.sendMessage(from, { text: "✅ Registro adicionado!" })
        }

        // ================= LISTA =================
        else if (command === "!lista") {

            const dados = lerPlanilha()
            if (dados.length === 0)
                return await sock.sendMessage(from, { text: "Nenhum registro." })

            let txt = "📊 REGISTROS:\n\n"

            dados.slice(-10).forEach(d => {
                txt += `ID:${d.ID}\n${d.Nome} - ${d.Valor}\n${d.Observacao}\n\n`
            })

            await sock.sendMessage(from, { text: txt })
        }

        // ================= BUSCAR =================
        else if (command.startsWith("!buscar")) {

            const nome = text.replace("!buscar", "").trim()
            const dados = lerPlanilha()
            const resultados = dados.filter(d => d.Nome.toLowerCase().includes(nome.toLowerCase()))

            if (resultados.length === 0)
                return await sock.sendMessage(from, { text: "Nada encontrado." })

            let txt = "🔎 RESULTADOS:\n\n"

            resultados.forEach(d => {
                txt += `ID:${d.ID}\n${d.Nome} - ${d.Valor}\n${d.Observacao}\n\n`
            })

            await sock.sendMessage(from, { text: txt })
        }

        // ================= DEL =================
        else if (command.startsWith("!del")) {

            const id = text.replace("!del", "").trim()
            let dados = lerPlanilha()
            dados = dados.filter(d => d.ID != id)

            salvarPlanilha(dados)
            backupAutomatico()

            await sock.sendMessage(from, { text: "🗑 Registro removido!" })
        }

        // ================= BACKUP =================
        else if (command === "!backup") {

            garantirPlanilha()

            await sock.sendMessage(from, {
                document: fs.readFileSync(PLANILHA),
                mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName: "backup-registros.xlsx"
            })
        }

        // ================= RELATORIO =================
        else if (command === "!relatorio") {

            const dados = lerPlanilha()
            let total = 0

            dados.forEach(d => total += Number(d.Valor) || 0)

            const resumo = `📊 RELATÓRIO\n\nTotal Registros: ${dados.length}\nTotal Valores: ${total}`

            await sock.sendMessage(from, { text: resumo })
        }

        // ================= PDF =================
        else if (command === "!pdf") {

            const dados = lerPlanilha()

            const doc = new PDFDocument()
            const pdfPath = "relatorio.pdf"
            const stream = fs.createWriteStream(pdfPath)

            doc.pipe(stream)

            doc.fontSize(18).text("RELATÓRIO", { align: "center" })
            doc.moveDown()

            dados.forEach(d => {
                doc.fontSize(12).text(`ID: ${d.ID}`)
                doc.text(`Nome: ${d.Nome}`)
                doc.text(`Valor: ${d.Valor}`)
                doc.text(`Obs: ${d.Observacao}`)
                doc.moveDown()
            })

            doc.end()

            stream.on("finish", async () => {
                await sock.sendMessage(from, {
                    document: fs.readFileSync(pdfPath),
                    mimetype: "application/pdf",
                    fileName: "relatorio.pdf"
                })
            })
        }

    })
}

startBot()

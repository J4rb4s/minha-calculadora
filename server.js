require("dotenv").config();

const express = require("express");

const app = express();

const cookieParser = require("cookie-parser");

app.use(cookieParser());

app.use(express.json());

app.get("/calculadora.html", (req, res) => {

    if (req.cookies.acessoCalculadora === "liberado") {

        return res.sendFile(
            __dirname + "/calculadora.html"
        );

    }

    res.status(403).send(
        "Acesso não autorizado. Realize o pagamento."
    );

});

app.use(express.static("."));

const PORT=process.env.PORT || 3000;

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/pagamento.html");
});


app.post("/criar-pagamento", async (req, res) => {

    try {

        console.log("1 - Iniciando criação do pagamento...");

        const resposta = await fetch(
            "https://api-sandbox.asaas.com/v3/customers",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "access_token": ASAAS_API_KEY
                },
                body: JSON.stringify({
                    name: "Cliente Teste",
                    cpfCnpj: "24971563792"
                })
            }
        );

        const cliente = await resposta.json();

        console.log("2 - Resposta do cliente:");
        console.log(cliente);

        if (!resposta.ok) {
            return res.status(400).json({
                erro: "Erro ao criar cliente",
                detalhes: cliente
            });
        }

        const pagamentoResposta = await fetch(
            "https://api-sandbox.asaas.com/v3/payments",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "access_token": ASAAS_API_KEY
                },
                body: JSON.stringify({
                    customer: cliente.id,
                    billingType: "PIX",
                    value: 5.00,
                    dueDate: new Date()
                        .toISOString()
                        .split("T")[0],
                    description: "Acesso à calculadora"
                })
            }
        );

        const pagamento = await pagamentoResposta.json();

        console.log("3 - Resposta do pagamento:");
        console.log(pagamento);

        if (!pagamentoResposta.ok) {
            return res.status(400).json({
                erro: "Erro ao criar pagamento",
                detalhes: pagamento
            });
        }

        const qrResposta = await fetch(
            `https://api-sandbox.asaas.com/v3/payments/${pagamento.id}/pixQrCode`,
            {
                method: "GET",
                headers: {
                    "access_token": ASAAS_API_KEY
                }
            }
        );

        const qrCode = await qrResposta.json();

        console.log("4 - Resposta do QR Code:");
        console.log(qrCode);

        if (!qrResposta.ok) {
            return res.status(400).json({
                erro: "Erro ao obter QR Code",
                detalhes: qrCode
            });
        }

        res.json({
            pagamentoId: pagamento.id,
            qrCode: qrCode.encodedImage,
            pixCopiaECola: qrCode.payload
        });

    } catch (erro) {

        console.error("ERRO:");
        console.error(erro);

        res.status(500).json({
            erro: "Erro interno",
            mensagem: erro.message
        });
    }

});

/*
 * Verificar status do pagamento
 */

app.get("/verificar-pagamento/:id", async (req, res) => {

    try {

        const pagamentoId = req.params.id;

        const resposta = await fetch(
            `https://api-sandbox.asaas.com/v3/payments/${pagamentoId}`,
            {
                method: "GET",

                headers: {
                    "access_token": ASAAS_API_KEY
                }
            }
        );

        const pagamento = await resposta.json();

        console.log(
            "Status Asaas:",
            pagamento.status
        );

        if (!resposta.ok) {

            return res.status(400).json({
                pago: false,
                erro: pagamento
            });

        }

        /*
         * PAYMENT_RECEIVED significa
         * que o pagamento foi recebido.
         */

        const pago =
	     pagamento.status === "PAYMENT_RECEIVED" ||
             pagamento.status === "RECEIVED";


	if (pago) {

    	   res.cookie(
             "acessoCalculadora",
             "liberado",
              {
                 httpOnly: true,
                 secure: false,
                 maxAge: 24 * 60 * 60 * 1000
           }
         );

}


	res.json({
   	   pago: pago,
   	   status: pagamento.status
	 });
   
 } catch (erro) {

        console.error(
            "Erro ao verificar pagamento:",
            erro
        );

        res.status(500).json({
            pago: false,
            erro: "Erro ao consultar pagamento."
        });

    }

});



app.listen(PORT, () => {
    console.log(
        `Servidor funcionando em http://localhost:${PORT}`
    );
});

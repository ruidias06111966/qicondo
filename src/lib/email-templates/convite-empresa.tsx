import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface ConviteEmpresaEmailProps {
  /** Nome de quem foi convidado, para tratar a pessoa pelo nome. */
  nome: string;
  /** Nome da empresa que está a convidar. */
  empresa: string;
  /** Perfil atribuído, já em texto legível (ex.: "Financeiro"). */
  perfil: string;
  /** Link de aceitação, com o token em claro. */
  urlConvite: string;
  /** Prazo de validade formatado (ex.: "15/03/2026"). */
  expiraEm?: string;
}

export const ConviteEmpresaEmail = ({
  nome,
  empresa,
  perfil,
  urlConvite,
  expiraEm,
}: ConviteEmpresaEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {nome}, você foi convidado para acessar {empresa} no QiCond
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você foi convidado</Heading>
        <Text style={text}>
          Olá, {nome}. Você recebeu um convite para acessar <strong>{empresa}</strong> no QiCond com
          o perfil <strong>{perfil}</strong>.
        </Text>
        <Text style={text}>
          Clique no botão abaixo para aceitar o convite e definir o seu acesso.
        </Text>
        <Button style={button} href={urlConvite}>
          Aceitar convite
        </Button>
        {expiraEm ? <Text style={text}>Este convite é válido até {expiraEm}.</Text> : null}
        <Text style={footer}>
          Se você não esperava este convite, pode ignorar este e-mail com segurança — nada será
          criado sem que você aceite.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default ConviteEmpresaEmail;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "20px 25px" };
const h1 = {
  fontSize: "22px",
  fontWeight: "bold" as const,
  color: "#000000",
  margin: "0 0 20px",
};
const text = {
  fontSize: "14px",
  color: "#55575d",
  lineHeight: "1.5",
  margin: "0 0 25px",
};
const button = {
  backgroundColor: "#000000",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: "6px",
  display: "inline-block",
  margin: "0 0 25px",
};
const footer = {
  fontSize: "12px",
  color: "#8898aa",
  lineHeight: "1.5",
  margin: "25px 0 0",
};

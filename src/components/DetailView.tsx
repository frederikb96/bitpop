import { Box, Text } from "ink";
import React from "react";
import { type BwItem, CipherType } from "../bw/client.js";

interface DetailViewProps {
	item: BwItem;
}

function Field({
	label,
	value,
	secret,
}: { label: string; value?: string | null; secret?: boolean }) {
	if (!value) return null;

	return (
		<Box>
			<Text color="gray">{label}: </Text>
			<Text color={secret ? "yellow" : "white"}>{value}</Text>
		</Box>
	);
}

function LoginDetails({ item }: { item: BwItem }) {
	const login = item.login;
	if (!login) return null;

	return (
		<>
			<Field label="Username" value={login.username} />
			<Field label="Password" value={login.password} secret />
			{login.totp && <Field label="TOTP" value="(has TOTP)" />}
			{login.uris?.map((uri, idx) => (
				<Field key={uri.uri} label={`URL ${idx + 1}`} value={uri.uri} />
			))}
		</>
	);
}

function CardDetails({ item }: { item: BwItem }) {
	const card = item.card;
	if (!card) return null;

	const expiry =
		card.expMonth && card.expYear
			? `${card.expMonth}/${card.expYear}`
			: undefined;
	const last4 = card.number?.slice(-4);

	return (
		<>
			<Field label="Cardholder" value={card.cardholderName} />
			<Field label="Brand" value={card.brand} />
			<Field
				label="Number"
				value={card.number ? `**** **** **** ${last4}` : undefined}
			/>
			<Field label="Full Number" value={card.number} secret />
			<Field label="Expiry" value={expiry} />
			<Field label="CVV" value={card.code} secret />
		</>
	);
}

function IdentityDetails({ item }: { item: BwItem }) {
	const id = item.identity;
	if (!id) return null;

	const fullName = [id.title, id.firstName, id.middleName, id.lastName]
		.filter(Boolean)
		.join(" ");

	return (
		<>
			<Field label="Name" value={fullName} />
			<Field label="Email" value={id.email} />
			<Field label="Phone" value={id.phone} />
			<Field label="Address" value={id.address1} />
			<Field label="City" value={id.city} />
			<Field label="State" value={id.state} />
			<Field label="Postal Code" value={id.postalCode} />
			<Field label="Country" value={id.country} />
		</>
	);
}

function SshKeyDetails({ item }: { item: BwItem }) {
	const ssh = item.sshKey;
	if (!ssh) return null;

	return (
		<>
			<Field label="Fingerprint" value={ssh.keyFingerprint} />
			<Field
				label="Public Key"
				value={ssh.publicKey ? `${ssh.publicKey.slice(0, 50)}...` : undefined}
			/>
		</>
	);
}

function SecureNoteDetails({ item }: { item: BwItem }) {
	return <Field label="Notes" value={item.notes} />;
}

export function DetailView({ item }: DetailViewProps) {
	return (
		<Box flexDirection="column" padding={1}>
			<Box borderStyle="single" borderColor="blue" paddingX={1}>
				<Text bold color="blue">
					{item.name}
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} paddingLeft={1}>
				{item.type === CipherType.Login && <LoginDetails item={item} />}
				{item.type === CipherType.Card && <CardDetails item={item} />}
				{item.type === CipherType.Identity && <IdentityDetails item={item} />}
				{item.type === CipherType.SshKey && <SshKeyDetails item={item} />}
				{item.type === CipherType.SecureNote && (
					<SecureNoteDetails item={item} />
				)}

				{item.notes && item.type !== CipherType.SecureNote && (
					<Box marginTop={1}>
						<Field label="Notes" value={item.notes} />
					</Box>
				)}
			</Box>

			<Box marginTop={1}>
				<Text color="gray">
					[Ctrl+U]ser [Ctrl+P]ass [Ctrl+T]OTP | [Esc] back | [Ctrl+D] quit
				</Text>
			</Box>
		</Box>
	);
}

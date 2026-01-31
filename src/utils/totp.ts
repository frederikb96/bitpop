import * as OTPAuth from "otpauth";

export interface TotpResult {
	code: string;
	remainingSeconds: number;
}

/**
 * Generate TOTP code from a Bitwarden totp field.
 * Handles otpauth:// URIs and plain base32 secrets.
 */
export function generateTotp(totpField: string): string | null {
	const result = generateTotpWithExpiry(totpField);
	return result?.code ?? null;
}

/**
 * Generate TOTP code with expiry information.
 * Returns both the code and seconds until it expires.
 */
export function generateTotpWithExpiry(totpField: string): TotpResult | null {
	if (!totpField) return null;

	try {
		let totp: OTPAuth.TOTP;

		if (totpField.startsWith("otpauth://")) {
			const parsed = OTPAuth.URI.parse(totpField);
			if (!(parsed instanceof OTPAuth.TOTP)) {
				return null;
			}
			totp = parsed;
		} else if (totpField.startsWith("steam://")) {
			return null;
		} else {
			totp = new OTPAuth.TOTP({
				secret: totpField,
				digits: 6,
				period: 30,
				algorithm: "SHA1",
			});
		}

		const code = totp.generate();
		const currentSecond = Math.floor(Date.now() / 1000) % totp.period;
		const remainingSeconds = totp.period - currentSecond;

		return { code, remainingSeconds };
	} catch {
		return null;
	}
}

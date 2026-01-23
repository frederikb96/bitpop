import * as OTPAuth from "otpauth";

/**
 * Generate TOTP code from a Bitwarden totp field.
 * Handles otpauth:// URIs and plain base32 secrets.
 */
export function generateTotp(totpField: string): string | null {
	if (!totpField) return null;

	try {
		let totp: OTPAuth.TOTP;

		if (totpField.startsWith("otpauth://")) {
			// Parse full otpauth URI
			const parsed = OTPAuth.URI.parse(totpField);
			if (!(parsed instanceof OTPAuth.TOTP)) {
				return null;
			}
			totp = parsed;
		} else if (totpField.startsWith("steam://")) {
			// Steam uses a different algorithm - not supported yet
			return null;
		} else {
			// Plain base32 secret - use defaults (6 digits, 30s period, SHA1)
			totp = new OTPAuth.TOTP({
				secret: totpField,
				digits: 6,
				period: 30,
				algorithm: "SHA1",
			});
		}

		return totp.generate();
	} catch {
		return null;
	}
}

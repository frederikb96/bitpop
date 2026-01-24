import { describe, expect, test } from "bun:test";
import { type BwItem, CipherType } from "../bw/client.js";
import {
	getCreateTemplate,
	itemToYaml,
	validateItem,
	yamlToItem,
} from "./yaml.js";

describe("getCreateTemplate", () => {
	test("returns non-empty template", () => {
		const template = getCreateTemplate();
		expect(template.length).toBeGreaterThan(0);
		expect(template).toContain("name:");
		expect(template).toContain("username:");
		expect(template).toContain("password:");
	});

	test("template has helpful comments", () => {
		const template = getCreateTemplate();
		expect(template).toContain("# Required");
		expect(template).toContain("Save and close");
	});
});

describe("itemToYaml", () => {
	test("converts basic login item", () => {
		const item: BwItem = {
			id: "test-id",
			type: 1,
			name: "Test Login",
			favorite: false,
			reprompt: 0,
			login: {
				username: "testuser",
				password: "testpass",
				uris: [{ uri: "https://example.com" }],
			},
		};

		const yaml = itemToYaml(item);
		expect(yaml).toContain('name: "Test Login"');
		expect(yaml).toContain('username: "testuser"');
		expect(yaml).toContain('password: "testpass"');
		expect(yaml).toContain('url: "https://example.com"');
	});

	test("includes TOTP secret", () => {
		const item: BwItem = {
			id: "test-id",
			type: 1,
			name: "With TOTP",
			favorite: false,
			reprompt: 0,
			login: {
				totp: "JBSWY3DPEHPK3PXP",
			},
		};

		const yaml = itemToYaml(item);
		expect(yaml).toContain('totp_secret: "JBSWY3DPEHPK3PXP"');
	});

	test("includes additional URLs", () => {
		const item: BwItem = {
			id: "test-id",
			type: 1,
			name: "Multi URL",
			favorite: false,
			reprompt: 0,
			login: {
				uris: [
					{ uri: "https://example.com" },
					{ uri: "https://api.example.com" },
					{ uri: "https://app.example.com" },
				],
			},
		};

		const yaml = itemToYaml(item);
		expect(yaml).toContain('url: "https://example.com"');
		expect(yaml).toContain("additional_urls:");
		expect(yaml).toContain('"https://api.example.com"');
		expect(yaml).toContain('"https://app.example.com"');
	});

	test("includes custom fields", () => {
		const item: BwItem = {
			id: "test-id",
			type: 1,
			name: "With Fields",
			favorite: false,
			reprompt: 0,
			login: {},
			fields: [
				{ name: "API Key", value: "secret123", type: 1 },
				{ name: "Account ID", value: "12345", type: 0 },
			],
		};

		const yaml = itemToYaml(item);
		expect(yaml).toContain("custom_fields:");
		expect(yaml).toContain("API Key");
		expect(yaml).toContain("Account ID");
	});
});

describe("yamlToItem", () => {
	test("parses basic YAML", () => {
		const yaml = `
name: My Login
username: myuser
password: mypass
url: https://example.com
`;
		const item = yamlToItem(yaml);
		expect(item).not.toBeNull();
		expect(item?.name).toBe("My Login");
		expect(item?.login?.username).toBe("myuser");
		expect(item?.login?.password).toBe("mypass");
		expect(item?.login?.uris?.[0]?.uri).toBe("https://example.com");
	});

	test("returns null for empty content", () => {
		expect(yamlToItem("")).toBeNull();
		expect(yamlToItem("   \n   ")).toBeNull();
	});

	test("returns null for missing name", () => {
		const yaml = `
username: myuser
password: mypass
`;
		expect(yamlToItem(yaml)).toBeNull();
	});

	test("ignores comment-only content", () => {
		const yaml = `
# This is just comments
# No actual content
`;
		expect(yamlToItem(yaml)).toBeNull();
	});

	test("parses additional URLs", () => {
		const yaml = `
name: Multi URL
url: https://main.com
additional_urls:
  - https://api.main.com
  - https://app.main.com
`;
		const item = yamlToItem(yaml);
		expect(item?.login?.uris).toHaveLength(3);
		expect(item?.login?.uris?.[0]?.uri).toBe("https://main.com");
		expect(item?.login?.uris?.[1]?.uri).toBe("https://api.main.com");
		expect(item?.login?.uris?.[2]?.uri).toBe("https://app.main.com");
	});

	test("parses custom fields", () => {
		const yaml = `
name: With Fields
custom_fields:
  - name: Secret Key
    value: abc123
    hidden: true
  - name: Note
    value: some text
`;
		const item = yamlToItem(yaml);
		expect(item?.fields).toHaveLength(2);
		expect(item?.fields?.[0]?.name).toBe("Secret Key");
		expect(item?.fields?.[0]?.value).toBe("abc123");
		expect(item?.fields?.[0]?.type).toBe(1); // hidden
		expect(item?.fields?.[1]?.name).toBe("Note");
		expect(item?.fields?.[1]?.type).toBe(0); // text
	});

	test("handles boolean fields", () => {
		const yaml = `
name: Test
favorite: true
reprompt: true
`;
		const item = yamlToItem(yaml);
		expect(item?.favorite).toBe(true);
		expect(item?.reprompt).toBe(1);
	});

	test("handles notes field", () => {
		const yaml = `
name: With Notes
notes: |
  This is a multi-line
  note with details.
`;
		const item = yamlToItem(yaml);
		expect(item?.notes).toContain("multi-line");
	});
});

describe("validateItem", () => {
	test("returns null for valid item", () => {
		const item = { name: "Test", type: CipherType.Login, login: {} };
		expect(validateItem(item)).toBeNull();
	});

	test("returns error for missing name", () => {
		const item = { type: CipherType.Login, login: {} };
		expect(validateItem(item)).toContain("Name is required");
	});

	test("returns error for empty name", () => {
		const item = { name: "   ", type: CipherType.Login, login: {} };
		expect(validateItem(item)).toContain("Name is required");
	});
});

describe("roundtrip", () => {
	test("item survives YAML roundtrip", () => {
		const original: BwItem = {
			id: "test-id",
			type: 1,
			name: "Roundtrip Test",
			favorite: true,
			reprompt: 1,
			notes: "Test notes",
			login: {
				username: "user@example.com",
				password: "secretpass",
				totp: "TOTP123",
				uris: [
					{ uri: "https://example.com" },
					{ uri: "https://api.example.com" },
				],
			},
			fields: [{ name: "API Key", value: "key123", type: 1 }],
		};

		const yaml = itemToYaml(original);
		const parsed = yamlToItem(yaml);

		expect(parsed?.name).toBe(original.name);
		expect(parsed?.login?.username).toBe(original.login?.username);
		expect(parsed?.login?.password).toBe(original.login?.password);
		expect(parsed?.login?.totp).toBe(original.login?.totp);
		expect(parsed?.favorite).toBe(original.favorite);
		expect(parsed?.reprompt).toBe(original.reprompt);
		expect(parsed?.login?.uris).toHaveLength(2);
		expect(parsed?.fields).toHaveLength(1);
	});

	test("handles special characters in name", () => {
		const original: BwItem = {
			id: "test-id",
			type: 1,
			name: 'Test: with "quotes" and colons',
			favorite: false,
			reprompt: 0,
			login: { username: "user" },
		};

		const yaml = itemToYaml(original);
		const parsed = yamlToItem(yaml);
		expect(parsed?.name).toBe(original.name);
	});

	test("handles newlines in password", () => {
		const original: BwItem = {
			id: "test-id",
			type: 1,
			name: "Test",
			favorite: false,
			reprompt: 0,
			login: { password: "pass\nwith\nnewlines" },
		};

		const yaml = itemToYaml(original);
		const parsed = yamlToItem(yaml);
		expect(parsed?.login?.password).toBe(original.login?.password);
	});

	test("handles backslashes in values", () => {
		const original: BwItem = {
			id: "test-id",
			type: 1,
			name: "C:\\Users\\test",
			favorite: false,
			reprompt: 0,
			login: { username: "domain\\user" },
		};

		const yaml = itemToYaml(original);
		const parsed = yamlToItem(yaml);
		expect(parsed?.name).toBe(original.name);
		expect(parsed?.login?.username).toBe(original.login?.username);
	});
});

require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("../config/db");

const ask = (label, hidden = false) => new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
        reject(new Error("Run this command in an interactive terminal."));
        return;
    }

    process.stdout.write(label);
    if (!hidden) {
        const readline = require("readline");
        const terminal = readline.createInterface({ input, output: process.stdout });
        terminal.once("line", (value) => {
            terminal.close();
            resolve(value.trim());
        });
        return;
    }

    const readline = require("readline");
    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    let value = "";

    const onKeypress = (character, key) => {
        if (key && key.ctrl && key.name === "c") {
            input.off("keypress", onKeypress);
            input.setRawMode(false);
            reject(new Error("Admin setup cancelled."));
            return;
        }
        if (key && (key.name === "return" || key.name === "enter")) {
            input.off("keypress", onKeypress);
            input.setRawMode(false);
            process.stdout.write("\n");
            resolve(value);
            return;
        }
        if (key && key.name === "backspace") {
            value = value.slice(0, -1);
            return;
        }
        if (character && !key.ctrl && !key.meta) value += character;
    };

    input.on("keypress", onKeypress);
});

async function createFirstAdmin() {
    const email = (await ask("Admin email: ")).toLowerCase();
    const password = await ask("Password (hidden): ", true);
    const confirmation = await ask("Confirm password (hidden): ", true);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
    }
    if (password.length < 12) {
        throw new Error("Use a password with at least 12 characters.");
    }
    if (password !== confirmation) {
        throw new Error("Passwords do not match.");
    }

    const [existingUsers] = await db.query("SELECT COUNT(*) AS count FROM users");
    if (Number(existingUsers[0].count) > 0) {
        throw new Error("An account already exists; first-admin setup is disabled.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.query(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'Admin')",
        [email, passwordHash]
    );
    process.stdout.write(`Created the first admin account for ${email}.\n`);
}

createFirstAdmin()
    .catch((error) => {
        console.error(`Admin setup failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => db.end());

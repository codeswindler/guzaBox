#!/usr/bin/env ts-node
/**
 * Generate M-Pesa B2C SecurityCredential from certificate and initiator password.
 * 
 * Usage:
 *   ts-node scripts/generate-b2c-credential.ts <cert-file> <initiator-password>
 * 
 * Example:
 *   ts-node scripts/generate-b2c-credential.ts production.cer "YourInitiatorPassword"
 * 
 * The output is the base64-encoded SecurityCredential to paste into .env:
 *   MPESA_B2C_SECURITY_CREDENTIAL="<output>"
 */

import * as fs from "fs";
import * as crypto from "crypto";

const certPath = process.argv[2];
const initiatorPassword = process.argv[3];

if (!certPath || !initiatorPassword) {
  console.error("Usage: ts-node scripts/generate-b2c-credential.ts <cert-file> <initiator-password>");
  console.error("\nExample:");
  console.error('  ts-node scripts/generate-b2c-credential.ts production.cer "MyPassword123"');
  process.exit(1);
}

if (!fs.existsSync(certPath)) {
  console.error(`Error: Certificate file not found: ${certPath}`);
  process.exit(1);
}

try {
  // Read the certificate file
  const certBuffer = fs.readFileSync(certPath);
  
  // Encrypt the initiator password using the certificate's public key
  const encrypted = crypto.publicEncrypt(
    {
      key: certBuffer,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(initiatorPassword, "utf8")
  );
  
  // Base64 encode the encrypted result
  const securityCredential = encrypted.toString("base64");
  
  console.log("\n✅ SecurityCredential generated successfully!\n");
  console.log("Add this to your .env file:");
  console.log(`MPESA_B2C_SECURITY_CREDENTIAL="${securityCredential}"\n`);
  console.log("⚠️  Keep this credential secure and never commit it to git!\n");
} catch (error: any) {
  console.error("Error generating SecurityCredential:");
  console.error(error.message);
  if (error.message.includes("PEM")) {
    console.error("\nTip: Make sure the certificate file is in PEM format (.cer or .pem)");
  }
  process.exit(1);
}

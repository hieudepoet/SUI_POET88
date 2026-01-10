/**
 * Cleanup Script - Delete all Beep invoices
 * 
 * Run from backend root: npx tsx src/cleanup-beep-invoices.ts
 */

import { BeepClient } from '@beep-it/sdk-core';
import { config } from 'dotenv';

// Load .env file
config();

const beepClient = new BeepClient({
    apiKey: process.env.BEEP_API_KEY || ''
});

async function deleteAllInvoices() {
    console.log('🔍 Fetching all invoices...');
    
    const invoices = await beepClient.invoices.listInvoices();
    console.log(`📋 Found ${invoices.length} invoices`);
    
    if (invoices.length === 0) {
        console.log('✅ No invoices to delete');
        return;
    }

    // Show first 5 invoices as preview
    console.log('\n📌 Preview (first 5):');
    invoices.slice(0, 5).forEach((inv: any) => {
        console.log(`  - ID: ${inv.id}, UUID: ${inv.uuid}, Status: ${inv.status}`);
    });

    console.log(`\n🗑️  Deleting ALL ${invoices.length} invoices...`);
    let deleted = 0;
    let failed = 0;

    for (const invoice of invoices) {
        try {
            const invoiceId = (invoice as any).uuid || invoice.id;
            await beepClient.invoices.deleteInvoice(invoiceId!);
            deleted++;
            process.stdout.write(`\r✅ Progress: ${deleted}/${invoices.length}`);
        } catch (error: any) {
            failed++;
            console.error(`\n❌ Failed to delete invoice ${invoice.id}:`, error.message);
        }
    }

    console.log(`\n\n✅ Cleanup complete!`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   Failed: ${failed}`);
}

// Run
(async () => {
    try {
        if (!process.env.BEEP_API_KEY) {
            console.error('❌ BEEP_API_KEY not found in environment');
            process.exit(1);
        }

        await deleteAllInvoices();
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
})();

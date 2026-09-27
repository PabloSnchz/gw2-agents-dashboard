// Test: verify all parsers work correctly
const https = require('https');

function fetchMd(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function run() {
    const base = 'https://raw.githubusercontent.com/PabloSnchz/gw2-wallet-agents/main/';

    // Fetch all 4 source files for KPIs
    const [teamStatus, alertsLog, commsLog, sessionLog] = await Promise.all([
        fetchMd(base + 'TEAM_STATUS.md'),
        fetchMd(base + 'ALERTS_LOG.md'),
        fetchMd(base + 'COMMS_LOG.md'),
        fetchMd(base + 'SESSION_LOG.md')
    ]);

    // Inline the parser methods for testing (since we can't require a JS file with class)
    function extractSection(md, heading) {
        const pattern = new RegExp('## ' + heading + '\\\\s*\\\\n([\\\\s\\\\S]*?)(?=\\\\n##|\\\\n\\\\n##|\\\\n$)', 'i');
        const match = md.match(pattern);
        return match ? match[1] : null;
    }

    function parseTeamStatus(md) {
        const data = { agents: [], crons: [], overallStatus: 'ok', lastHeartbeat: null };
        if (!md) return data;

        const tsMatch = md.match(/> Actualizado:?\s*(.+)/i);
        if (tsMatch) data.lastHeartbeat = tsMatch[1].trim();

        const tareasSection = extractSection(md, 'Tareas en curso');
        if (tareasSection) {
            const lines = tareasSection.split('\n');
            let currentName = null, currentDesc = '';
            for (const line of lines) {
                const m = line.match(/^(- )?\*\*([^*]+):\*\*/);
                if (m) {
                    if (currentName) {
                        const desc = currentDesc.trim();
                        let status = 'unknown';
                        if (/⏱|timeout/i.test(desc)) status = 'timeout';
                        else if (/✅/.test(desc) && !/⏱/i.test(desc)) status = 'ok';
                        else if (/🔄/.test(desc)) status = 'running';
                        data.agents.push({ name: currentName, status, desc });
                    }
                    currentName = m[2].trim();
                    currentDesc = line.substring(m[0].length).trim();
                } else if (currentName && line.trim()) {
                    currentDesc += '\n' + line;
                }
            }
            if (currentName) {
                const desc = currentDesc.trim();
                let status = 'unknown';
                if (/⏱|timeout/i.test(desc)) status = 'timeout';
                else if (/✅/.test(desc) && !/⏱/i.test(desc)) status = 'ok';
                else if (/🔄/.test(desc)) status = 'running';
                data.agents.push({ name: currentName, status, desc: desc.substring(0, 200) });
            }
        }
        return data;
    }

    function parseAlerts(md) {
        const data = { total: 0, active: 0, bySeverity: { critical: 0, medium: 0, low: 0 }, details: [] };
        if (!md) return data;

        const activeSection = extractSection(md, 'Alertas activas');
        if (activeSection) {
            // Parse table rows (lines starting with |)
            const rows = activeSection.split('\n').filter(l => l.startsWith('|') && !l.match(/\|[-:| ]+\|/));
            for (const row of rows) {
                if (!row.includes('# |') && !row.match(/\|[-:| ]+\|/)) {
                    const cols = row.split('|').slice(1, -1).map(c => c.trim());
                    if (cols.length >= 6) {
                        data.active++;
                        const sev = cols[1] || '';
                        if (/🔴|Alta/i.test(sev)) data.bySeverity.critical++;
                        else if (/🟡|Media/i.test(sev)) data.bySeverity.medium++;
                        else if (/🟢|Baja/i.test(sev)) data.bySeverity.low++;
                        data.details.push({ severity: sev, description: cols[2] || '', agent: cols[3] || '' });
                    }
                }
            }
        }
        return data;
    }

    function parseComms(md) {
        const data = { total: 0, pending: 0, inProgress: 0, timeout: 0, details: [] };
        if (!md) return data;

        const activeSection = extractSection(md, 'Comunicaciones activas');
        if (activeSection) {
            const rows = activeSection.split('\n').filter(l => l.startsWith('|') && !l.match(/\|[-:| ]+\|/));
            for (const row of rows) {
                if (!row.includes('# |') && !row.match(/\|[-:| ]+\|/)) {
                    const cols = row.split('|').slice(1, -1).map(c => c.trim());
                    if (cols.length >= 6) {
                        data.total++;
                        const state = cols[4] || '';
                        if (/⏳|Esperando/.test(state)) data.pending++;
                        if (/⏱|timeout/i.test(state)) data.timeout++;
                        data.details.push({ from: cols[1] || '', to: cols[2] || '', request: cols[3] || '', state });
                    }
                }
            }
        }
        return data;
    }

    function parseSessionLog(md) {
        const data = { sessionCount: 0 };
        if (!md) return data;
        const headers = md.match(/^## .+/gm);
        data.sessionCount = headers ? headers.length : 0;
        return data;
    }

    // Run parsers
    const agents = parseTeamStatus(teamStatus);
    const alerts = parseAlerts(alertsLog);
    const comms = parseComms(commsLog);
    const sessions = parseSessionLog(sessionLog);

    console.log('=== Team Status ===');
    console.log(`Last heartbeat: ${agents.lastHeartbeat}`);
    console.log(`Agents (${agents.agents.length}):`);
    agents.agents.forEach(a => console.log(`  ${a.name} → ${a.status}`));

    console.log('\n=== Alerts ===');
    console.log(`Active: ${alerts.active}, Total: ${alerts.total}`);
    console.log(`By severity: CRITICAL=${alerts.bySeverity.critical}, MEDIUM=${alerts.bySeverity.medium}, LOW=${alerts.bySeverity.low}`);
    alerts.details.forEach(a => console.log(`  ${a.severity} ${a.description.substring(0, 50)}`));

    console.log('\n=== Comms ===');
    console.log(`Total: ${comms.total}, Pending: ${comms.pending}, Timeout: ${comms.timeout}`);
    comms.details.forEach(c => console.log(`  ${c.from} → ${c.to}: ${c.state} (${c.request.substring(0, 40)})`));

    console.log('\n=== Sessions ===');
    console.log(`Session count: ${sessions.sessionCount}`);

    // Summary
    console.log('\n=== KPI SUMMARY ===');
    const running = agents.agents.filter(a => a.status === 'ok' || a.status === 'running').length;
    console.log(`Agentes: ${running}/${agents.agents.length} OK`);
    console.log(`Alertas: ${alerts.active} active, ${alerts.bySeverity.critical} critical`);
    console.log(`Comms: ${comms.pending} pending, ${comms.timeout} timeout`);
    console.log(`Logs: ${sessions.sessionCount} sessions`);
}

run().catch(console.error);

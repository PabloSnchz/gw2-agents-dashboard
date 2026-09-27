/**
 * js/test-parser.js
 * Test harness for DashboardParser — runs parser on fetched TEAM_STATUS.md
 * and logs results to console + UI.
 * USAGE: include this script AFTER parser.js on a test HTML page,
 * call TestParser.run()
 */

(() => {
    window.TestParser = {
        async run() {
            const results = {};
            
            try {
                const resp = await fetch('https://raw.githubusercontent.com/PabloSnchz/gw2-wallet-agents/main/TEAM_STATUS.md?v=' + Date.now());
                const md = await resp.text();
                results.rawLength = md.length;
                results.hasDocumenter = md.includes('documenter');
                
                // Test _extractSection
                const section = DashboardParser._extractSection(md, 'Tareas en curso');
                results.sectionFound = section !== null;
                results.sectionLength = section ? section.length : 0;
                
                if (section) {
                    // Count agent lines
                    const lines = section.split('\n');
                    const agentLines = lines.filter(l => /^(- )?\*\*[^*]+:\*\*/.test(l));
                    results.extractedAgentCount = agentLines.length;
                    results.agentLineTexts = agentLines.map(l => l.substring(0, 60));
                    
                    // Check each line
                    lines.forEach((line, i) => {
                        const isAgent = /^(- )?\*\*[^*]+:\*\*/.test(line);
                        if (isAgent || (line.includes('**') && line.trim().startsWith('-'))) {
                            results[`line_${i}`] = line.trim().substring(0, 80);
                        }
                    });
                }
                
                // Test full parse
                const parsed = DashboardParser.parseTeamStatus(md);
                results.parseable = parsed.parseable;
                results.parsedAgentCount = parsed.agents ? parsed.agents.length : 0;
                results.parsedAgentNames = parsed.agents ? parsed.agents.map(a => a.name) : [];
                results.parsedAgentStatuses = parsed.agents ? parsed.agents.map(a => a.status) : [];
                
            } catch (e) {
                results.error = e.message;
            }
            
            // Display results
            const container = document.getElementById('test-results');
            if (container) {
                let html = '<div style="text-align:left; font-family: monospace; white-space: pre-wrap; padding: 10px;">';
                for (const [key, value] of Object.entries(results)) {
                    if (Array.isArray(value)) {
                        html += `${key}: [${value.map(v => `'${v}'`).join(', ')}]\n`;
                    } else if (typeof value === 'object') {
                        html += `${key}: ${JSON.stringify(value)}\n`;
                    } else {
                        html += `${key}: ${value}\n`;
                    }
                }
                html += '</div>';
                container.innerHTML = html;
            }
            
            console.log('=== TestParser Results ===', results);
            return results;
        }
    };
})();

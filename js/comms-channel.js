/**
 * js/comms-channel.js
 * Panel del CANAL DE AGENTES (automatizado).
 *
 * Esto NO es lo mismo que el bloque "Comunicaciones" de arriba, que se arma
 * parseando COMMS_LOG.md a mano por el equipo. Esto es el canal durable:
 * un sistema de mensajes en disco (C:\Users\psanc\.qwenpaw\_comms) donde un
 * agente le hace una pregunta a otro y la respuesta queda guarantee de
 * llegar, con recibo, sin depender de un task_id que caduca.
 *
 * El puente es export_dashboard.py, que vuelca el canal a data/comms.json
 * en ESTE repo (el canal vive en disco local; si no se exportara, el
 * dashboard no tendria nada que mostrar).
 *
 * Los mensajes se agrupan por estado, que es la pregunta que importa de
 * verdad cuando estas dormido: hay algo que se quedo esperando ahi?
 *
 *   overdue  - se veto el plazo y nadie respondio       (ROJO,Priority)
 *   asked    - entregada pero NO registrada como        (NARANJA)
 *               esperando: alguien mando una pregunta y
 *               no espero la respuesta
 *   waiting  - esperando respuesta, plazo todavia vive  (AMARILLO)
 *   answered - respondida, falta que el emisor la cierre (VERDE)
 *   closed   - cerrada y archivada                      (GRIS, es historia)
 */

const CHANNEL_ESTADOS = [
    { key: 'overdue',  label: 'Vencidas',     variant: 'critical',     icon: '🔴',
      help: 'Se paso el plazo y nadie respondio. Requieren tu atencion.' },
    { key: 'asked',    label: 'Sin registrar', variant: 'important',   icon: '🟠',
      help: 'Pregunta entregada, pero el emisor no la registro como esperando. ' +
            'Se respondio igual o quedo flotando.' },
    { key: 'waiting',  label: 'Esperando',    variant: 'important',    icon: '🟡',
      help: 'Pregunta entregada, esperando respuesta, plazo vigente.' },
    { key: 'answered', label: 'Respondidas',  variant: 'routine',      icon: '🟢',
      help: 'Hay respuesta, el emisor todavia no la cerro.' },
    { key: 'closed',   label: 'Cerradas',     variant: 'unclassified', icon: '⚪',
      help: 'Respondidas y archivadas. Historia.' }
];

const CommsChannel = {
    data: null,

    async load() {
        const cfg = window.DASHBOARD_CONFIG;
        if (!cfg || !cfg.getCommsChannelUrl) return;
        try {
            const res = await fetch(cfg.getCommsChannelUrl() + '?t=' + Date.now());
            if (!res.ok) throw new Error('HTTP ' + res.status);
            this.data = await res.json();
        } catch (e) {
            this.data = null;
            this._error = e.message;
        }
        this.render();
    },

    _esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    render() {
        this._renderEstado();
        this._renderKpis();
        this._renderGrupos();
        this._renderDisciplina();
    },

    _renderEstado() {
        const c = document.getElementById('comms-channel-estado');
        if (!c) return;
        if (this.data) {
            const s = this.data.sonda || {};
            const racha = (s.streak || 0) + '/3';
            c.innerHTML = '<span class="cc-meta">Exportado ' +
                this._esc(this.data.generado_h || '?') +
                ' &middot; ' + this._esc(this.data.total) + ' mensajes' +
                ' &middot; sonda racha ' + this._esc(racha) + '</span>';
        } else {
            c.innerHTML = '<span class="cc-meta cc-meta--warn">Sin datos: ' +
                this._esc(this._error || 'no se pudo leer data/comms.json') +
                ' &mdash; el exportador corre cada 30 min junto a la sonda.</span>';
        }
    },

    _renderKpis() {
        const c = document.getElementById('comms-channel-kpis');
        if (!c) return;
        if (!this.data) { c.innerHTML = ''; return; }
        const n = this.data.conteo || {};
        c.innerHTML = CHANNEL_ESTADOS.map(e =>
            '<div class="kpi-card kpi-card--' + e.variant + ' cc-kpi">' +
                '<div class="kpi-value">' + (n[e.key] || 0) + '</div>' +
                '<div class="kpi-title">' + e.icon + ' ' + e.label + '</div>' +
            '</div>'
        ).join('');
    },

    _card(m) {
        const replied = m.replied_h
            ? '<div class="comm-card__meta">Respondido ' + this._esc(m.replied_h) +
              ' por ' + this._esc(m.replied_by) + '</div>'
            : '<div class="comm-card__meta">Sin respuesta todavia</div>';
        const body = this._esc(m.body || '').slice(0, 240);
        const reply = m.reply
            ? '<div class="cc-reply"><strong>Respuesta:</strong> ' +
              this._esc(m.reply).slice(0, 300) + '</div>'
            : '';
        return '<div class="comm-card cc-card">' +
            '<div class="comm-card__header">' +
                '<span class="comm-card__type">' + this._esc(m.kind) + '</span>' +
                '<span class="cc-subject">' + this._esc(m.subject || '(sin asunto)') + '</span>' +
            '</div>' +
            '<div class="comm-card__agents">' +
                this._esc(m.from_label || m.from) + ' &rarr; ' + this._esc(m.to_label || m.to) +
            '</div>' +
            '<div class="comm-card__summary">' + body + '</div>' +
            reply +
            '<div class="comm-card__meta">' + this._esc(m.created_h || '') +
                ' &middot; ' + this._esc(m.estado_nota || '') + '</div>' +
            replied +
        '</div>';
    },

    // Cuando miraron el canal por ultima vez.
    //
    // Esto NO es decorativo. El paso 0 esta escrito en el HEARTBEAT.md
    // de cada agente, y una instruccion escrita en un .md no es una
    // garantia: el PO ya se autocorrijo por reportar como propio un
    // hallazgo que otro ya habia subido. Ese es exactamente el costo
    // que mide esto.
    //
    // Lo que convierte la instruccion en garantia es que mirar deje
    // rastro. Si un agente no mira, el reloj de aca lo delata, sin que
    // nadie tenga que acordarse de reportarlo.
    _renderDisciplina() {
      // Vive en UNA sola tab: Equipo, arriba de todo.
      //
      // Antes se dibujaba en Salud y en Logs, y las dos copias mostraban lo
      // mismo. Tres lugares para un dato son tres lugares donde puede quedar
      // viejo o desincronizado, y una señal repetida en tres tabs termina
      // pesando igual que una repetida en dos: deja de ser señal. Ademas la
      // tab Logs es la ultima que uno mira, y la disciplina no es un log: es
      // como esta de vivo el equipo. En Equipo responde la pregunta que uno
      // se hace al abrirla — "como estan" — y ahi conviven el heartbeat vivo
      // y la bandeja: un agente puede tener el proceso encendido y no estar
      // hablando con nadie, y eso solo se ve en estos dos juntos.
      const targets = [];
      let equipo = document.getElementById('equipo-disciplina');
      if (!equipo) {
        // Si el navegador tiene el index.html viejo cacheado, el contenedor
        // no existe. Crearlo aca evita depender de que el HTML llegue
        // fresco: el dato es lo que tiene que estar al dia, no el esqueleto.
        const caja = document.querySelector('[data-tab-content="equipo"]');
        if (caja) {
          equipo = document.createElement('div');
          equipo.id = 'equipo-disciplina';
          equipo.className = 'comms-kpi-grid';
          caja.insertBefore(equipo, caja.firstChild);
        }
      }
      if (equipo) targets.push(equipo);

      // Las copias viejas (Salud y Logs) se limpian siempre. Con un
      // index.html cacheado siguen en el DOM y quedarian con el ultimo
      // render — es decir, mostrando un dato viejo con toda la apariencia
      // de estar al dia.
      ['eco-salud-disciplina', 'cc-disciplina'].forEach(id => {
        const viejo = document.getElementById(id);
        if (viejo && viejo.parentNode) viejo.parentNode.removeChild(viejo);
      });

      if (!targets.length) return;
      if (!this.data) { targets.forEach(b => b.innerHTML = ''); return; }
      const d = this.data.disciplina || [];
      if (!d.length) { targets.forEach(b => b.innerHTML = ''); return; }

      const variante = { ok: 'routine', vencido: 'critical', demanda: 'unclassified' };
      const html = d.map(r => {
        let v, titulo;
        if (r.vigencia === 'bajo demanda') {
          v = 'demanda';
          titulo = 'bajo demanda';
        } else if (r.lectura_vencida) {
          v = 'vencido';
          titulo = r.minutos_sin_mirar === null ? 'nunca miro'
                   : 'hace ' + r.minutos_sin_mirar + ' min';
        } else {
          v = 'ok';
          titulo = r.minutos_sin_mirar === null ? 'sin registro'
                   : 'hace ' + r.minutos_sin_mirar + ' min';
        }
        const pend = r.preguntas_sin_responder || 0;
        return '<div class="kpi-card kpi-card--' + variante[v] + ' cc-kpi">' +
                 '<div class="kpi-value" style="font-size:1.05rem">' +
                   this._esc(r.agente) + '</div>' +
                 '<div class="cc-meta">' + this._esc(titulo) +
                   (r.umbral_min ? ' &middot; umbral ' + r.umbral_min + 'm' : '') +
                 '</div>' +
                 '<div class="cc-meta' + (pend ? ' cc-meta--warn' : '') + '">' +
                   this._esc(pend > 0 ? pend + ' sin responder' : 'todo contestado') +
                 '</div>' +
               '</div>';
      }).join('');
      targets.forEach(b => b.innerHTML = html);
    },

    _renderGrupos() {
        const c = document.getElementById('comms-channel-lista');
        if (!c) return;
        if (!this.data) {
            c.innerHTML = '<p class="cc-empty">Todavia no hay datos del canal.</p>';
            return;
        }
        const msgs = this.data.mensajes || [];
        if (!msgs.length) {
            c.innerHTML = '<p class="cc-empty">El canal esta vacio. ' +
                'No es un error: significa que nadie se dejo una pregunta sin responder.</p>';
            return;
        }

        const html = CHANNEL_ESTADOS.map(e => {
            const items = msgs.filter(m => m.estado === e.key);
            if (!items.length) return '';
            return '<div class="comms-group comms-group--' + e.variant + '">' +
                '<div class="comms-group__header" title="' + this._esc(e.help) + '">' +
                    '<span class="comms-group__label">' + e.icon + ' ' + e.label + '</span>' +
                    '<span class="comms-group__count">' + items.length + '</span>' +
                '</div>' +
                '<div class="comms-group__items">' +
                    items.map(m => this._card(m)).join('') +
                '</div>' +
            '</div>';
        }).join('');

        c.innerHTML = html ||
            '<p class="cc-empty">Ningun mensaje en un estado conocido.</p>';
    }
};

window.CommsChannel = CommsChannel;

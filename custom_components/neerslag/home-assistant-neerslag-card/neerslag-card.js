import {
	LitElement,
	html,
	css
} from "lit";
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.register(annotationPlugin);

class CombiCard extends LitElement {

	static get properties() {
		return {
			hass: { type: Object },
			_config: { type: Object },
			myChart: { state: true }
		};
	}

	static getStubConfig() {
		return {
			entity: "sensor.neerslag_buienalarm_regen_data",
			title: "Neerslag"
		}
	}

	static get styles() {
		return css`
			:host {
				display: block;
			}
			ha-card {
				position: relative;
			}
			ha-icon {
				position: absolute;
				top: 30px;
				right: 40px;
			}
			#plotGraphCard {
				padding: 0px 16px 16px 16px;
			}
		`;
	}

	static TRANSLATIONS = {
		nl : {
			regenMmUur : 'Regen (mm / uur)',
			regenvalVoorspelling : 'Regenval voorspelling',
			licht : 'Licht',
			matig : 'Matig',
			zwaar : 'Zwaar',
			geenDataBeschikbaar: 'Geen sensor data beschikbaar',
		},
		en : {
			regenMmUur : 'Rain (mm / hr)',
			regenvalVoorspelling : 'Rainfall forecast',
			licht : 'Light',
			matig : 'Moderate',
			zwaar : 'Heavy',
			geenDataBeschikbaar: 'No sensor data available',
		},
		fr : {
			regenMmUur : 'Pluie (mm / h)',
			regenvalVoorspelling : 'Prévision de précipitations',
			licht : 'Légère',
			matig : 'Moyenne',
			zwaar : 'Forte',
			geenDataBeschikbaar: 'Pas de données du senseur disponibles',
		}
	};

	setConfig(config) {
		if (!config.entity && !config.entities) {
			throw new Error('You need to define an entity or a list of entities.');
		}
		this._config = config;
		this.zoomwaarde = 5.5;
		this._lastDataState = null;
	}

	getCardSize() {
		return 2;
	}

	localize(key) {
		const lang = this.getCurrentLanguage();
		const translationSet = CombiCard.TRANSLATIONS[lang] || CombiCard.TRANSLATIONS['nl'];
		return translationSet[key] || CombiCard.TRANSLATIONS['nl'][key] || 'No translation found';
	}

	getCurrentLanguage() {
		const storedLang = (localStorage.getItem('selectedLanguage') || '').replace(/['"]+/g, '').replace('-', '_');
		if (storedLang) return storedLang;
		return (navigator.language || navigator.userLanguage).replace(/['"]+/g, '').replace('-', ' ').substring(0, 2);
	}

	render() {
		if (!this._config || !this.hass) return html``;

		const stateObj = this._config.entity ? this.hass.states[this._config.entity] : null;
		const stateMultiObj = (this._config.entities || []).map(e => this.hass.states[e]);

		if (!stateObj && !stateMultiObj.some(Boolean)) {
			return html`
				<ha-card>
					<h1 class="card-header">${this._config.title}</h1>
					<div style="background-color: var(--error-color, red); padding: 8px; color: white;">
						Entity or Entities not available.
					</div>
					<ha-icon icon="mdi:weather-rainy"></ha-icon>
				</ha-card>
			`;
		}

		if (this._config.autozoom === true) {
			this.zoomwaarde = 0.5;
		}

		const chartDataSets = this.prepareChartDataSets();
		if (!chartDataSets.getChartsDataAlsArray()[0]) {
			return html`
				<ha-card>
					<ha-icon style="right:20px" icon="mdi:weather-rainy"></ha-icon>
					<h1 class="card-header"><div class="name">${this._config.title}</div></h1>
					<div id="plotGraphCard">
						<div style="display: block;">${this.localize('geenDataBeschikbaar')}</div>
					</div>
				</ha-card>
			`;
		}

		return html`
			<ha-card>
				<ha-icon style="right:20px" icon="mdi:weather-rainy"></ha-icon>
				<h1 class="card-header">
					<div class="name">${this._config.title}</div>
				</h1>
				<div id="plotGraphCard">
					<div id="neerslagChartContainer" style="display: block;">
						<canvas id="neerslagChart"></canvas>
					</div>
				</div>
			</ha-card>
		`;
	}

	firstUpdated() {
		this.makeGraph();
	}

	updated(changedProperties) {
		if (changedProperties.has('hass')) {
			this.updateGrafiek();
		}
		if (changedProperties.has('_config')) {
			this.makeGraph();
		}
	}

	makeGraph() {
		const canvas = this.renderRoot.querySelector('#neerslagChart');
		if (!canvas) return;

		if (this.myChart) {
			this.myChart.destroy();
		}

		const style = getComputedStyle(document.body);
		const primaryColor = this.convertToHex(style.getPropertyValue('--primary-color'));
		const secondaryTextColor = this.convertToHex(style.getPropertyValue('--secondary-text-color'));
		const primaryTextColor = this.convertToHex(style.getPropertyValue('--primary-text-color'));

		const ctx = canvas.getContext('2d');
		
		this.myChart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: this.prepareChartDataSets().getChartsDataAlsArray()[0]?.[0] || [],
				datasets: this.prepareChartDataSets().getChartDatasets()
			},
			options: {
				backgroundColor: [primaryColor.replace(' ','') + '33'],
				borderColor: [primaryColor],
				scales: {
					y: {
						ticks: { color: secondaryTextColor },
						beginAtZero: true,
						title: {
							display: true,
							text: this.localize('regenMmUur'),
							color: primaryTextColor,
						},
						suggestedMax: this.zoomwaarde,
					},
					x: {
						ticks: { color: secondaryTextColor },
						title: {
							display: true,
							text: this.localize('regenvalVoorspelling'),
							color: primaryTextColor,
						}
					}
				},
				animation: false,
				interaction: { intersect: false, mode: 'index' },
				borderWidth: 2,
				tension: 0.4,
				pointRadius: 0,
				spanGaps: true,
				fill: true,
				plugins: {
					legend: { display: false },
					tooltip: {
						displayColors: false,
						callbacks: {
							label: (context) => {
								let label = context.dataset.label || '';
								if (label) label += ': ';
								if (context.parsed.y !== null) label += context.parsed.y + " mm/u";
								return label;
							}
						}
					},
					annotation: {
						annotations: {
							lineZwaar: { type: 'line', yMin: 5, yMax: 5, borderColor: 'grey', borderWidth: 1, label: { enabled: true, content: this.localize('zwaar'), position: 'end' } },
							lineMatig: { type: 'line', yMin: 2, yMax: 2, borderColor: 'grey', borderWidth: 1, label: { enabled: true, content: this.localize('matig'), position: 'end' } },
							lineLicht: { type: 'line', yMin: 0.4, yMax: 0.4, borderColor: 'grey', borderWidth: 1, label: { enabled: true, content: this.localize('licht'), position: 'end' } }
						}
					}
				}
			}
		});
	}

	updateGrafiek() {
		if (!this.myChart) return;
		
		const currentDataState = this._getCurrentDataState();
		if (this._lastDataState === currentDataState) {
			return;
		}
		this._lastDataState = currentDataState;

		const dataSets = this.prepareChartDataSets();
		const labels = dataSets.getChartsDataAlsArray()[0]?.[0];
		if (!labels) return;

		this.myChart.data.labels = labels;
		this.myChart.data.datasets = dataSets.getChartDatasets();
		this.myChart.update('none');
	}

	_getCurrentDataState() {
		const states = [];
		if (this._config.entity) {
			const s = this.hass.states[this._config.entity];
			states.push(s ? s.state + JSON.stringify(s.attributes?.data) : 'null');
		}
		if (this._config.entities) {
			this._config.entities.forEach(e => {
				const s = this.hass.states[e];
				states.push(s ? s.state + JSON.stringify(s.attributes?.data) : 'null');
			});
		}
		return states.join('|');
	}

	convertToHex(color) {
		if (!color) return '#000000';
		if (color.includes('#')) return color.trim();
		
		const values = color.replace(/rgba?\(/, '').replace(/\)/, '').replace(/[\s+]/g, '').split(',');
		if (values.length < 3) return color;
		
		let a = parseFloat(values[3] || 1),
			r = Math.floor(a * parseInt(values[0]) + (1 - a) * 255),
			g = Math.floor(a * parseInt(values[1]) + (1 - a) * 255),
			b = Math.floor(a * parseInt(values[2]) + (1 - a) * 255);
		return "#" + ("0" + r.toString(16)).slice(-2) + ("0" + g.toString(16)).slice(-2) + ("0" + b.toString(16)).slice(-2);
	}

	generateDatasetObject(data, vlabel = "Regen") {
		if (vlabel.includes("arm")) vlabel = "Buienalarm";
		if (vlabel.includes("dar")) vlabel = "Buienradar";
		return { label: vlabel, data: data };
	}

	prepareChartDataSets() {
		let chartsDataAlsArray = [];
		let chartDatasets = [];
		
		if (this._config.entity) {
			const data = this.prepareData(this.getEntityData(this.hass, this._config.entity), this._config.entity);
			if (data.length > 0) {
				chartsDataAlsArray.push(data);
				chartDatasets.push(this.generateDatasetObject(data[1], this._config.entity));
			}
		} else if (this._config.entities) {
			for (const entity of this._config.entities) {
				const data = this.prepareData(this.getEntityData(this.hass, entity), entity);
				if (data.length > 0) {
					chartsDataAlsArray.push(data);
					chartDatasets.push(this.generateDatasetObject(data[1], entity));
				}
			}
			if (chartsDataAlsArray.length >= 2) {
				this.combineTwoArray(chartsDataAlsArray[0], chartsDataAlsArray[1]);
			}
		}

		return {
			getChartsDataAlsArray: () => chartsDataAlsArray,
			getChartDatasets: () => chartDatasets
		};
	}

	getEntityData(hass, entity) {
		return hass && hass.states && hass.states[entity] && hass.states[entity].attributes
			? hass.states[entity].attributes.data
			: undefined;
	}

	combineTwoArray(array1, array2) {
		if (!array1 || !array2 || !array1[0] || !array2[0]) return;
		for (const data of array1[0]) {
			if (!array2[0].includes(data)) {
				let index = array1[0].indexOf(data);
				array2[0].splice(index, 0, array1[0][index]);
				array2[1].splice(index, 0, '0');
			}
		}
	}

	prepareData(data, entity) {
		if (!data) return [];
		try {
			if (typeof data === 'string' && data.includes('|')) {
				return this.formatBuienradarData(data);
			}
			if (Array.isArray(data)) {
				if (data.precip && Array.isArray(data.precip)) {
					return this.formatBuienalarmDataAndere(data);
				}
				if (data[0] && typeof data[0].rain !== 'undefined') {
					return this.formatBuienalarmData(data);
				}
			}
		} catch (e) {
			console.warn("neerslag-card: could not process data", e);
		}
		return [];
	}

	formatBuienradarData(data) {
		if (typeof data !== 'string') return [];
		const dataArray = data.trim().split(' ');
		let tijd = [], rain = [];
		for (const defaultElement of dataArray) {
			let num = Math.pow(10, ((parseInt(defaultElement.split('|')[0] - 109) / 32)));
			rain.push(Math.round(num * 100) / 100);
			tijd.push(defaultElement.split('|')[1]);
		}
		return [tijd, rain];
	}

	formatBuienalarmData(data) {
		if (!Array.isArray(data)) return [];
		const addZero = (i) => (i < 10 ? "0" + i : i);
		let rain = data.map(item => item.rain);
		let tijd = data.map(item => {
			let d = new Date(item.date);
			return addZero(d.getHours()) + ":" + addZero(d.getMinutes());
		});
		return [tijd, rain];
	}

	formatBuienalarmDataAndere(data) {
		const addZero = (i) => (i < 10 ? "0" + i : i);
		if (!Array.isArray(data.precip) || data.start === undefined || data.delta === undefined) return [];
		
		let rain = data.precip.map(item => parseFloat(Math.pow(10, (item - 109) / 32)).toFixed(2));
		let tijd = data.precip.map((item, index) => {
			let d = new Date(0);
			d.setUTCSeconds(data.start + (index * data.delta));
			return addZero(d.getHours()) + ":" + addZero(d.getMinutes());
		});
		return [tijd, rain];
	}
}

customElements.define('neerslag-card', CombiCard);
window.customCards = window.customCards || [];
window.customCards.push({
	type: "neerslag-card",
	name: "Neerslag Card",
	preview: true,
	description: "Display rain forecast using BuienAlarm and/or BuienRadar data."
});

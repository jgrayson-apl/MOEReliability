/*
 Copyright 2021 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 *
 * SummaryResults
 *  - Summary Results
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  9/16/2021 - 0.0.1 -
 * Modified:
 *
 */

class SummaryResults {

  static version = '0.0.1';

  static FORMATTERS = {
    INT: new Intl.NumberFormat('default', {minimumFractionDigits: 0, maximumFractionDigits: 0}),
    COUNT: new Intl.NumberFormat('default', {minimumFractionDigits: 0, maximumFractionDigits: 0}),
    MOE: new Intl.NumberFormat('default', {minimumFractionDigits: 1, maximumFractionDigits: 1}),
    PCT: new Intl.NumberFormat('default', {style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1})
  };

  UI = {
    countNode: document.querySelector('.stat-node[data-stat="count"]'),
    countSumNode: document.querySelector('.stat-node[data-stat="count-sum"]'),
    countSumMoeNode: document.querySelector('.stat-node[data-stat="count-sum-moe"]'),
    pctSumNode: document.querySelector('.stat-node[data-stat="pct-sum"]'),
    pctSumMoeNode: document.querySelector('.stat-node[data-stat="pct-sum-moe"]'),
    cvChartNode: document.getElementById('cv-chart-node')
  };

  /**
   * @type {SummaryField}
   */
  acsSummaryField;

  /**
   *
   * @param {SummaryField} acsSummaryField
   */
  constructor({acsSummaryField}) {

    // ACS SUMMARY FIELD //
    this.acsSummaryField = acsSummaryField;

    // COEFFICIENT OF VARIATION CHART //
    this.initializeCVChart();
  }

  /**
   *
   */
  clearResults() {
    this.UI.countNode.innerHTML = '--';
    this.UI.countSumNode.innerHTML = '--';
    this.UI.countSumMoeNode.innerHTML = '--';
    this.UI.pctSumNode.innerHTML = '--';
    this.UI.pctSumMoeNode.innerHTML = '--';
    this.updateCVChart();
  }

  /**
   *
   * @param feature
   */
  updateFeatureResults(feature) {
    this.clearResults();

  }

  /**
   * https://www.census.gov/content/dam/Census/library/publications/2020/acs/acs_general_handbook_2020_ch08.pdf
   *
   * Reliability:
   *  High reliability: (CV =< 12%)
   *  Medium reliability: (12% < CV <=40%)
   *  Low reliability: (40% < CV)
   *
   * @param {{COUNT:number,NUMERATOR_SUM:number,NUMERATOR_MOE_SUM_SQ:number,DENOMINATOR_SUM:number,DENOMINATOR_MOE_SUM_SQ:number}} statInfos
   */
  updateResults(statInfos) {
    if (statInfos) {

      // COUNT //
      this.UI.countNode.innerHTML = SummaryResults.FORMATTERS.INT.format(statInfos.COUNT);

      // VALID SUMMARY //
      if (this.acsSummaryField.valid && statInfos.COUNT) {

        // D8 //
        const numerator_sum = statInfos.NUMERATOR_SUM;
        // E8 //
        const numerator_moe_sqrt_sum_sq = Math.sqrt(statInfos.NUMERATOR_MOE_SUM_SQ);

        if (this.acsSummaryField.valueType === 'count-or-amount') {
          //
          // COUNTS //
          //

          this.UI.pctSumNode.innerHTML = '--';
          this.UI.pctSumMoeNode.innerHTML = '--';

          this.UI.countSumNode.innerHTML = SummaryResults.FORMATTERS.INT.format(numerator_sum);
          this.UI.countSumMoeNode.innerHTML = `±${ SummaryResults.FORMATTERS.INT.format(numerator_moe_sqrt_sum_sq) }`;

          // D9 = (E8/1.645)/D8*100
          const coefficientOfVariation = ((numerator_moe_sqrt_sum_sq / 1.645) / numerator_sum * 100);
          this.updateCVChart(coefficientOfVariation);

        } else {
          //
          // PERCENTS //
          //

          this.UI.countSumNode.innerHTML = '--';
          this.UI.countSumMoeNode.innerHTML = '--';

          // B8 //
          const denominator_sum = statInfos.DENOMINATOR_SUM;
          // C8 //
          const denominator_moe_sqrt_sum_sq = Math.sqrt(statInfos.DENOMINATOR_MOE_SUM_SQ);

          // F8 = D8/B8*100
          const percent = (numerator_sum / denominator_sum * 100.0);
          this.UI.pctSumNode.innerHTML = SummaryResults.FORMATTERS.PCT.format(percent / 100.0);

          // (D8/B8)^2
          const percentSq = Math.pow(numerator_sum / denominator_sum, 2.0);
          // (E8^2)
          const moeNumeratorSq = Math.pow(numerator_moe_sqrt_sum_sq, 2.0);
          // (C8^2)
          const moeDenominatorSq = Math.pow(denominator_moe_sqrt_sum_sq, 2.0);

          // (E8^2)-1*(D8/B8)^2*(C8^2)
          // let radicand = ((moeNumeratorSq - 1) * percentSq * moeDenominatorSq);
          let radicand = (moeNumeratorSq - (percentSq * moeDenominatorSq));
          if (radicand < 0.0) {
            radicand = (moeNumeratorSq + (percentSq * moeDenominatorSq));
          }

          // G8 = (100/B8)*(SQRT((E8^2)-1*(D8/B8)^2*(C8^2)))
          const moeOfPercent = (100.0 / denominator_sum) * Math.sqrt(radicand);
          this.UI.pctSumMoeNode.innerHTML = `±${ SummaryResults.FORMATTERS.PCT.format(moeOfPercent / 100.0) }`;

          // F9 = (G8/1.645)/F8*100
          const coefficientOfVariation = ((moeOfPercent / 1.645) / percent * 100.0);
          this.updateCVChart(coefficientOfVariation);

        }
      } else { this.clearResults(); }
    } else { this.clearResults(); }
  }

  /**
   * https://www.npmjs.com/package/chartjs-gauge
   */
  initializeCVChart() {

    const cvChart = new Chart(this.UI.cvChartNode, {
      type: 'gauge',
      data: {
        labels: ['high', 'medium', 'low'],
        datasets: [{
          data: [12, 40, 52],
          value: null,
          backgroundColor: ['#9bccec', '#ede18b', '#f79e94'],
          borderColor: '#dedede',
          borderWidth: 1.0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        title: {display: false},
        layout: {padding: {top: 13, right: 0, bottom: 13, left: 0}},
        cutoutPercentage: 60,
        needle: {
          radiusPercentage: 1,
          widthPercentage: 5,
          lengthPercentage: 40,
          color: 'transparent'
        },
        valueLabel: {
          display: true,
          bottomMarginPercentage: 1,
          fontSize: 21,
          padding: {top: 6, right: 6, bottom: 6, left: 6},
          color: '#ffffff',
          backgroundColor: '#007ac2',
          formatter: function (value) {
            if (value == null) {
              return ' n/a ';
            } else {
              return (value < 100) ? `${ value.toFixed(1) }%` : '> 100%';
            }
          }
        },
        plugins: {
          datalabels: {
            display: true,
            formatter: function (value, context) {
              return context.chart.data.labels[context.dataIndex];
            },
            padding: {top: 5, right: 5, bottom: 2, left: 5},
            borderRadius: 4,
            font: {size: 9},
            color: '#424242',
            backgroundColor: 'rgba(255,255,255,0.8)'
          }
        }
      }
    });

    /**
     *
     * @param {number} [coefficientOfVariation]
     */
    this.updateCVChart = (coefficientOfVariation) => {

      if (Number.isNaN(coefficientOfVariation)) {
        cvChart.options.needle.color = 'transparent';
        cvChart.data.datasets[0].value = null;
      } else {
        cvChart.options.needle.color = (coefficientOfVariation < 52) ? '#007ac2' : 'transparent';
        cvChart.data.datasets[0].value = coefficientOfVariation;
      }

      cvChart.update();
    };

  }

}

export default SummaryResults;

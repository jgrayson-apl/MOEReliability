/*
 Copyright 2020 Esri

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
 * SummaryField
 *  - Summary Statistic Field
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  8/31/2021 - 0.0.1 -
 * Modified:
 *
 */

class SummaryField extends EventTarget {

  /**
   *
   * @type {string[]}
   */
  static VALID_FIELD_VALUE_TYPES = ['count-or-amount', 'percentage-or-ratio'];

  /**
   *
   * @type {string}
   */
  MARGIN_OF_ERROR = `Margin of Error`;

  /**
   * @type {MapView}
   * @private
   */
  _view;

  /**
   * @type {FeatureLayer}
   * @private
   */
  _acsLayer = null;

  /**
   *
   * @returns {FeatureLayer}
   */
  get acsLayer() {
    return this._acsLayer;
  }

  /**
   *
   * @param {FeatureLayer} acsLayer
   */
  set acsLayer(acsLayer) {

    // SET CURRENT ACS LAYER //
    this._acsLayer = acsLayer;
    this._acsLayerView = null;
    this._addACSLayerToMap();

    this._acsField = null;
    this._clearFields();
  }

  /**
   *
   * @returns {string|null}
   */
  get layerTitle() {
    return this._acsLayer ? this._acsLayer.title : null;
  }

  /**
   * @type {FeatureLayerView}
   * @private
   */
  _acsLayerView;

  /**
   *
   * @returns {FeatureLayerView}
   */
  get acsLayerView() {
    return this._acsLayerView;
  }

  /**
   * @type  {Field}
   * @private
   */
  _acsField = null;

  /**
   *
   * @param {Field} acsField
   */
  set acsField(acsField) {
    this._acsField = acsField;
    this._discoverAnalysisFields();
  }

  /**
   * @type {Field}
   */
  get acsField() {
    return this._acsField;
  }

  /**
   *
   * @returns {string|null}
   */
  get valueType() {
    return this._acsField ? this._acsField.valueType : null;
  }

  /**
   *
   * @returns {string|null}
   */
  get name() {
    return this._acsField ? this._acsField.name : null;
  }

  /**
   *
   * @returns {string|null}
   */
  get alias() {
    return this._acsField ? this._acsField.alias : null;
  }

  /**
   *
   * @type {boolean}
   */
  logFieldValidity = false;

  /**
   * ANALYSIS FIELDS //
   */
  numerator;
  numerator_moe;
  denominator;
  denominator_moe;

  /**
   *
   * @returns {string[]}
   */
  get fieldNames() {
    const fieldNames = [];

    this.numerator && fieldNames.push(this.numerator.name);
    this.numerator_moe && fieldNames.push(this.numerator_moe.name);
    this.denominator && fieldNames.push(this.numerator.name);
    this.denominator_moe && fieldNames.push(this.denominator_moe.name);

    return fieldNames;
  }

  /**
   *
   * @returns {boolean}
   */
  get valid() {
    return (this._acsLayer != null) && (this._acsField != null);
  }

  /**
   *
   * @param {MapView} view
   */
  constructor({view}) {
    super();

    this._view = view;
  }

  /**
   *
   * @private
   */
  _addACSLayerToMap() {

    // REMOVE PREVIOUS LAYER //
    const previousLayers = this._view.map.layers.filter(l => l.type !== 'graphics');
    previousLayers.length && this._view.map.removeMany(previousLayers);

    if (this._acsLayer) {

      // UPDATE LAYER //
      this._acsLayer.set({
        title: this._acsLayer.portalItem.title.replace(/ - Centroids/, '')
      });

      // ADD NEW LAYER //
      this._view.popup.close();
      this._view.map.add(this._acsLayer, 0);

      // SET LAYER VIEW WHEN READY //
      this._view.whenLayerView(this._acsLayer).then(acsLayerView => {
        this._acsLayerView = acsLayerView;
        this.dispatchEvent(new CustomEvent('layerview-ready', {detail: {layerView: this._acsLayerView}}));
      });
    }
  };

  /**
   *
   * @private
   */
  _clearFields() {
    this.numerator = null;
    this.numerator_moe = null;
    this.denominator = null;
    this.denominator_moe = null;
  }

  /**
   *
   * @private
   */
  _discoverAnalysisFields() {

    switch (this._acsField.valueType) {
      case 'count-or-amount':
        this.numerator = this._acsField;
        this.numerator_moe = this._getMOEField(this._acsField);
        this.denominator = null;
        this.denominator_moe = null;
        break;

      case 'percentage-or-ratio':
        const {numerator, denominator} = this._getPercentFields(this._acsField);
        this.numerator = numerator;
        this.numerator_moe = this._getMOEField(numerator);
        this.denominator = denominator;
        this.denominator_moe = this._getMOEField(denominator);
        break;
      default:
        this._clearFields();
    }
  }

  /**
   *
   * @param acsField
   * @returns {null|Field}
   * @private
   */
  _getMOEField(acsField) {
    if (this._acsLayer && acsField && acsField.name.endsWith('E')) {
      return this._acsLayer.getField(acsField.name.replace(/E$/, 'M'));
    } else {
      return null;
    }
  }

  /**
   *
   * @param acsField
   * @returns {null|{numerator: Field, denominator: Field}}
   * @private
   */
  _getPercentFields(acsField) {
    if (this._acsLayer && acsField) {
      const fieldMatch = acsField.description.match(/Esri Calculated Field:.*\*(.*)\/(.*),/i);
      const hasMatch = (fieldMatch && (fieldMatch.length > 0));
      return {
        numerator: hasMatch ? this._acsLayer.getField(fieldMatch[1]) : null,
        denominator: hasMatch ? this._acsLayer.getField(fieldMatch[2]) : null
      };
    } else {
      return {numerator: null, denominator: null};
    }
  }

  /**
   *
   * @param {Field} acsField
   * @returns {boolean}
   */
  isValidField(acsField) {

    const notMedianField = !acsField.alias.startsWith('Median');
    const validValueType = SummaryField.VALID_FIELD_VALUE_TYPES.includes(acsField.valueType);
    const notMOEField = !acsField.alias.endsWith(this.MARGIN_OF_ERROR);
    const moeField = this._getMOEField(acsField);
    const hasMOEField = (moeField != null);

    if (this.logFieldValidity) {
      console.log(`[ ${ acsField.name } ][ ${ acsField.valueType } ] [ ${ moeField?.name || 'NO MOE FIELD' } ] ||| notMedianField:${ notMedianField } ||| validValueType:${ validValueType } | notMOEField:${ notMOEField } | hasMOEField:${ hasMOEField }`);
    }

    return notMedianField && validValueType && notMOEField && hasMOEField;
  }

  /**
   *
   * @returns {Field[]}
   */
  getValidFields() {
    return this._acsLayer.fields.filter(this.isValidField, this);/*.sort((a, b) => {
      return a.alias.localeCompare(b.alias);
    });*/
  }

}

export default SummaryField;

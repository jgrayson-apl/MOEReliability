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

import SummaryFieldItem from './SummaryFieldItem.js';

/**
 *
 * SummaryFieldList
 *  - Summary Field List
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  4/21/2022 - 0.0.1 -
 * Modified:
 *
 */

class SummaryFieldList extends HTMLElement {

  static version = '0.0.1';

  layer;
  fieldItems;

  _tileGroup;
  _filter;

  constructor({container}) {
    super();

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.host.classList.add('summary-field-list');
    shadowRoot.innerHTML = `
      <style>
        :host{
          /* ... */
        }           
        .summary-field-list {
          /* ... */
        }      
        :host calcite-tile-select-group{
          margin: 1px;
        }
        :host calcite-input{
          position: sticky;
          top: 0;
          z-index: 99;
          padding: 5px;
          margin-bottom: 1px;
          background-color: var(--calcite-ui-foreground-1);          
        }                         
      </style>      
      <calcite-input clearable autofocus type="search" icon="selected-items-filter" placeholder="filter fields"></calcite-input>
      <calcite-tile-select-group layout="vertical"></calcite-tile-select-group>            
    `;

    container.append(this);

  }

  /**
   *
   */
  connectedCallback() {

    this._tileGroup = this.shadowRoot.querySelector('calcite-tile-select-group');

    this._filterInput = this.shadowRoot.querySelector('calcite-input');
    this._filterInput.addEventListener('calciteInputInput', () => {
      this._filter = this._filterInput.value;
      this.filterUpdated();
    });

  }

  /**
   *
   * @param {Layer} value
   */
  set layer(value){
    this.layer = value;



    this.fieldItems = this.layer.fields.map(field => {
      return new SummaryFieldItem({field});
    });

    this._tileGroup.replaceChildren(...this.fieldItems);
  }


  /**
   *
   * @param {HTMLElement} node
   * @returns {boolean}
   * @private
   */
  _hideNode = node => node.toggleAttribute('hidden', true);

  /**
   *
   * @param {HTMLElement} node
   * @returns {boolean}
   * @private
   */
  _showNode = node => node.toggleAttribute('hidden', false);

  /**
   *
   */
  filterUpdated() {
    if (this._filter) {
      this._tileGroup.querySelectorAll(`calcite-tile-select`).forEach(this._hideNode);
      const searchParams = ['heading', 'description', 'value'].map(attr => {
        return `calcite-tile-select[${ attr }*='${ this._filter }' i]`;
      }).join(',');
      this._tileGroup.querySelectorAll(`${ searchParams }`).forEach(this._showNode);
    } else {
      this._tileGroup.querySelectorAll(`calcite-tile-select`).forEach(this._showNode);
    }
  }

}

customElements.define('summary-field-list', SummaryFieldList);

export default SummaryFieldList;

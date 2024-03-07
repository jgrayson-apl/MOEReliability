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

import SummaryLayerItem from './SummaryLayerItem.js';
import SummaryFieldList from './SummaryFieldList.js';

/**
 *
 * SummaryLayerList
 *  - Summary Layer List
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  4/21/2022 - 0.0.1 -
 * Modified:
 *
 */

class SummaryLayerList extends HTMLElement {

  static version = '0.0.1';

  portalItems;
  layerItems;

  _tileGroup;
  _filter;

  constructor({container, portalItems}) {
    super();

    this.portalItems = portalItems;

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.host.classList.add('summary-layer-list');
    shadowRoot.innerHTML = `
      <style>        
        :host{         
          /* ... */
        }           
        .summary-layer-list {
          padding: 1px;
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
      <calcite-input clearable autofocus type="search" icon="layer-filter" placeholder="filter layers"></calcite-input>
      <calcite-tile-select-group layout="vertical"></calcite-tile-select-group>            
    `;

    container.append(this);

  }

  /**
   *
   */
  connectedCallback() {

    this.layerItems = this.portalItems.map(portalItem => {
      const summaryLayerItem = new SummaryLayerItem({portalItem});
      summaryLayerItem.addEventListener('layer-selected', ({detail: {layer}}) => {
        this.dispatchEvent(new CustomEvent('layer-selected', {detail: {layer}}));
      });
      return summaryLayerItem;
    });

    this._tileGroup = this.shadowRoot.querySelector('calcite-tile-select-group');
    this._tileGroup.replaceChildren(...this.layerItems);

    this._filterInput = this.shadowRoot.querySelector('calcite-input');
    this._filterInput.addEventListener('calciteInputInput', () => {
      this._filter = this._filterInput.value;
      this.filterUpdated();
    });

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

customElements.define('summary-layer-list', SummaryLayerList);

export default SummaryLayerList;

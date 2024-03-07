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

/**
 *
 * SummaryFieldItem
 *  - Summary Field Item
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  4/21/2022 - 0.0.1 -
 * Modified:
 *
 */

class SummaryFieldItem extends HTMLElement {

  static version = '0.0.1';

  field;

  /**
   *
   */
  constructor({field}) {
    super();

    this.field = field;

    const valueTypeIcon = (this.field.valueType === 'count-or-amount') ? 'number' : 'percent';

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.host.classList.add('summary-field-item');
    shadowRoot.innerHTML = `
      <style>
        :host{
          /* ... */
        }  
        .summary-field-item {
          /* ... */
        }                            
      </style>      
      <calcite-tile-select
        heading="${ this.field.alias }"
        description="${ this.field.description }"        
        value="${ this.field.name }"
        title="${ this.field.name }"
        icon="${ valueTypeIcon }"
        input-enabled
        input-alignment="end"
        type="radio"
        name="acs-field"        
        width="full">
      </calcite-tile-select>
    `;

  }

  /**
   *
   */
  connectedCallback() {

    const fieldTile = this.shadowRoot.querySelector('calcite-tile-select');
    fieldTile.addEventListener('calciteTileSelectChange', () => {
      this.dispatchEvent(new CustomEvent('field-selected', {detail: {field: this.field}}));
    });

  }

}

customElements.define('summary-field-item', SummaryFieldItem);

export default SummaryFieldItem;

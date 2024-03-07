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
 * SummaryLayerItem
 *  - Summary Layer Item
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  4/21/2022 - 0.0.1 -
 * Modified:
 *
 */

class SummaryLayerItem extends HTMLElement {

  static version = '0.0.1';

  portalItem;
  layer;

  constructor({portalItem}) {
    super();

    this.portalItem = portalItem;

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.host.classList.add('summary-layer-item');
    shadowRoot.innerHTML = `
      <style>
        :host{
          /* ... */
        }
        .summary-layer-item{
          /* ... */
        }                            
      </style>      
      <calcite-tile-select
        heading="${ this.portalItem.title.replace(/ - Centroids/, '') }"
        description="${ this.portalItem.snippet }"
        value="${ this.portalItem.id }"
        title="${ this.portalItem.title }"
        icon="layer-points"
        input-enabled
        input-alignment="end"
        type="radio"
        name="acs-layer"        
        width="full">
      </calcite-tile-select>
    `;

  }

  connectedCallback() {

    const layerTile = this.shadowRoot.querySelector('calcite-tile-select');
    layerTile.addEventListener('calciteTileSelectChange', () => {
      this.getTrackCentroidLayer().then((layer) => {
        this.layer = layer;
        this.dispatchEvent(new CustomEvent('layer-selected', {detail: {layer: this.layer}}));
      });
    });

  }

  /**
   *
   * @returns {Promise<Layer>}
   */
  getTrackCentroidLayer() {
    return new Promise((resolve, reject) => {
      require(['esri/layers/Layer'], (Layer) => {
        Layer.fromPortalItem({portalItem: this.portalItem}).then(groupLayer => {
          groupLayer.loadAll().then(() => {
            resolve(groupLayer.layers.find(layer => layer.title === 'Tract'));
          }).catch(reject);
        }).catch(reject);
      });
    });
  };

}

customElements.define('summary-layer-item', SummaryLayerItem);

export default SummaryLayerItem;

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

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import SummaryField from './SummaryField.js';
import SummaryResults from './SummaryResults.js';

class Application extends AppBase {

  // PORTAL //
  portal;

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // APP TITLE //
        this.title = this.title || map?.portalItem?.title || 'Application';
        // APP DESCRIPTION //
        this.description = this.description || map?.portalItem?.description || group?.description || '...';

        if (view) {
          this.initializeViewShareable({view});
        }

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').removeAttribute('active');
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   * @param view
   */
  configView(view) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/widgets/Home',
          'esri/widgets/Search',
          "esri/widgets/Bookmarks",
          'esri/widgets/Legend'
        ], (Home, Search, Bookmarks, Legend) => {

          //
          // CONFIGURE VIEW SPECIFIC STUFF HERE //
          //
          view.set({
            constraints: {snapToZoom: false},
            popup: {
              dockEnabled: true,
              dockOptions: {
                buttonEnabled: false,
                breakpoint: false,
                position: 'top-center'
              }
            },
            highlightOptions: {
              color: '#d83020',
              haloOpacity: 0.8,
              fillOpacity: 0.05
            }
          });

          // SEARCH //
          const search = new Search({view: view});
          view.ui.add(search, {position: 'top-left', index: 0});

          // HOME //
          const home = new Home({view});
          view.ui.add(home, {position: 'top-left', index: 1});

          // LEGEND //
          const legend = new Legend({view: view});
          view.ui.add(legend, {position: 'bottom-left', index: 0});

          // BOOKMARKS //
          const bookmarks = new Bookmarks({container: "bookmarks-container", view: view});

          // VIEW UPDATING //
          this.disableViewUpdating = false;
          const viewUpdating = document.getElementById('view-updating');
          view.ui.add(viewUpdating, 'bottom-right');
          this._watchUtils.init(view, 'updating', updating => {
            (!this.disableViewUpdating) && viewUpdating.toggleAttribute('active', updating);
          });

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {

      // ACS GROUP //
      this.acsGroup = group;

      // VIEW READY //
      this.configView(view).then(() => {

        this.initializeSketchTools(view);

        this.initializeACSContent(portal, view);

        this.initializeACSLayerRendering(view);

        resolve();
      }).catch(reject);

    });
  }

  /**
   *
   * @param view
   */
  initializeSketchTools(view) {
    require([
      'esri/layers/GraphicsLayer',
      'esri/widgets/Sketch'
    ], (GraphicsLayer, Sketch) => {

      const tractSnappingLayer = view.map.layers.find(l=>l.title === '');

      const sketchSymbol = {
        type: 'simple-fill',
        color: 'transparent',
        outline: {color: '#d83020', width: 3.5}
      };

      // SKETCH LAYER //
      const sketchLayer = new GraphicsLayer({title: 'Summary Sketch', listMode: 'hide'});
      view.map.add(sketchLayer);

      // SKETCH CONTAINER //
      const sketchContainer = document.createElement('div');

      // SKETCH WIDGET //
      const sketch = new Sketch({
        container: sketchContainer,
        view: view,
        layer: sketchLayer,
        snappingOptions:{
          enabled: true,
          //featureSources: [{ layer: tractSnappingLayer, enabled: true }]
        },
        availableCreateTools: ['polygon', 'rectangle', 'circle'],
        creationMode: 'update',
        defaultCreateOptions: {},
        defaultUpdateOptions: {multipleSelectionEnabled: false},
        visibleElements: {selectionTools: {'rectangle-selection': false, "lasso-selection": false}},
        visible: true
      });
      sketch.viewModel.set({polygonSymbol: sketchSymbol});

      // COLLAPSIBLE SKETCH BLOCK //
      const sketchBlock = document.createElement('calcite-block');
      sketchBlock.toggleAttribute('collapsible', true);
      sketchBlock.toggleAttribute('open', true);
      sketchBlock.setAttribute('heading', 'Areas of Interest');
      sketchBlock.setAttribute('description', 'use these tool to sketch an analysis area');
      sketchBlock.append(sketchContainer);
      view.ui.add(sketchBlock, {position: 'top-right'});

      this.getSketchGeometry = () => {
        return (sketch.updateGraphics.length) ? sketch.updateGraphics.getItemAt(0).geometry : null;
      };

      sketch.on('create', (evt) => {
        switch (evt.state) {
          case 'active':
          case 'complete':
            this._evented.emit('analysis-geometry', {geometry: evt.graphic.geometry});
            break;
          case 'cancel':
            this._evented.emit('analysis-geometry', {});
            break;
        }
      });

      sketch.on('update', (evt) => {
        if (evt.aborted) {
          this._evented.emit('analysis-geometry', {});
        } else {
          switch (evt.state) {
            case 'start':
            case 'active':
            case 'complete':
              this._evented.emit('analysis-geometry', {geometry: evt.graphics[0].geometry});
              break;
            case 'cancel':
              this._evented.emit('analysis-geometry', {});
              break;
          }
        }
      });

      sketch.on(['undo', 'redo'], (evt) => {
        this._evented.emit('analysis-geometry', {geometry: evt.graphics[0].geometry});
      });

      this._evented.on("source-change", ({acsSummaryField}) => {
        sketch.visible = acsSummaryField.valid;
      });

    });
  }

  /**
   *
   * American Community Survey (ACS) Current 5-year Estimates
   *
   * https://esri.maps.arcgis.com/home/group.html?id=16b3a5ac36834ed6b3f16261d9a988ea&view=list&categories=%5B%22%2FCategories%2FCentroids%22%5D#content
   *
   * @param portal
   * @param view
   */
  initializeACSContent(portal, view) {
    require([
      'esri/core/promiseUtils',
      'esri/core/watchUtils',
      'esri/layers/Layer'
    ], (promiseUtils, watchUtils, Layer) => {

      // SUMMARY FIELD INFORMATION //
      let acsSummaryField = new SummaryField({view});

      // SUMMARY RESULTS //
      let acsSummaryResults = new SummaryResults({acsSummaryField});

      // UI //
      const tileLayerSearchInput = document.getElementById('tile-layer-search-input');
      const tileFieldSearchInput = document.getElementById('tile-field-search-input');
      const acsFieldTabTitle = document.getElementById('acs-field-tab-title');

      const acsLayerList = document.getElementById('acs-layer-select');
      const acsFieldList = document.getElementById('acs-field-select');
      const acsLayerTileTemplate = document.getElementById('acs-layer-tile-template');
      const acsFieldTileTemplate = document.getElementById('acs-field-tile-template');

      // CURRENT LAYER AND FIELD NAMES //
      const selectedCentroidLayerLink = document.getElementById('selected-centroid-layer-link');
      const selectedCentroidLayerInput = document.getElementById('selected-centroid-layer-input');
      const selectedCountFieldInput = document.getElementById('selected-count-field-input');
      this._evented.on("source-change", ({acsSummaryField}) => {

        const hasLayer = (acsSummaryField.acsLayer != null);
        selectedCentroidLayerLink.toggleAttribute('disabled', !hasLayer);

        selectedCentroidLayerInput.value = selectedCentroidLayerInput.title = acsSummaryField.layerTitle;
        selectedCentroidLayerInput.setAttribute('status', hasLayer ? 'valid' : 'invalid');

        selectedCountFieldInput.value = selectedCountFieldInput.title = acsSummaryField.alias;
        selectedCountFieldInput.setAttribute('status', (acsSummaryField.acsField != null) ? 'valid' : 'invalid');

      });

      selectedCentroidLayerLink.addEventListener('click', () => {
        if (acsSummaryField.acsLayer != null) {
          window.open(`https://www.arcgis.com/home/item.html?id=${ acsSummaryField.acsLayer.portalItem.id }`);
        }
      });

      const fieldSortActionAlpha = document.getElementById('field-sort-alpha');
      const fieldSortActionTable = document.getElementById('field-sort-table');

      // Adapted from: https://dev.to/nijeesh4all/sort-html-elements-with-flex-3cdc
      const orderFunctions = {
        'alpha': (a, b) => a.dataset.sortalpha.localeCompare(b.dataset.sortalpha),
        'table': (a, b) => Number(a.dataset.sorttable) - Number(b.dataset.sorttable)
      };
      const sortFieldsList = (sortOrder) => {
        const _sortOrder = sortOrder || (fieldSortActionAlpha.hasAttribute('active') ? 'alpha' : 'table');
        const ordered = Array.from(acsFieldList.querySelectorAll('calcite-tile-select')).sort(orderFunctions[_sortOrder]);
        ordered.forEach((elem, index) => elem.style.order = String(index));
        this.scrollToSelectedFieldTile();
      };
      fieldSortActionAlpha.addEventListener('click', () => {
        fieldSortActionAlpha.toggleAttribute('active', true);
        fieldSortActionTable.toggleAttribute('active', false);
        sortFieldsList('alpha');
      });
      fieldSortActionTable.addEventListener('click', () => {
        fieldSortActionTable.toggleAttribute('active', true);
        fieldSortActionAlpha.toggleAttribute('active', false);
        sortFieldsList('table');
      });

      // TOGGLE NODE //
      const _hideNode = node => node.toggleAttribute('hidden', true);
      const _showNode = node => node.toggleAttribute('hidden', false);

      //
      // https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors
      //
      /**
       *
       * @param {HTMLElement} list
       * @param {HTMLInputElement} input
       * @private
       */
      const _updateListFilter = (list, input) => {
        return () => {
          if (input.value) {
            list.querySelectorAll(`calcite-tile-select`).forEach(_hideNode);
            const searchParams = ['heading', 'description', 'value'].map(attr => {
              return `calcite-tile-select[${ attr }*='${ input.value }' i]`;
            }).join(',');
            list.querySelectorAll(`${ searchParams }`).forEach(_showNode);
          } else {
            list.querySelectorAll(`calcite-tile-select`).forEach(_showNode);
          }
        };
      };

      /**
       *
       * @param {HTMLElement} list
       * @param {HTMLInputElement} input
       * @private
       */
      const _clearListFilter = (list, input) => {
        return () => {
          input.value = null;
          list.querySelectorAll(`calcite-tile-select`).forEach(_showNode);
        };
      };

      // LIST FILTERS //
      const listFilters = {
        layer: {
          update: _updateListFilter(acsLayerList, tileLayerSearchInput),
          clear: _clearListFilter(acsLayerList, tileLayerSearchInput)
        },
        field: {
          update: _updateListFilter(acsFieldList, tileFieldSearchInput),
          clear: _clearListFilter(acsFieldList, tileFieldSearchInput)
        }
      };

      const activateSearchInput = (tab) => {
        tileLayerSearchInput.toggleAttribute('hidden', (tab !== 'acs-layer'));
        tileFieldSearchInput.toggleAttribute('hidden', (tab !== 'acs-field'));
      };

      const acsTabNav = document.getElementById('acs-tab-nav');
      acsTabNav.addEventListener('calciteTabChange', ({detail: {tab}}) => {
        activateSearchInput(tab);
      });
      tileLayerSearchInput.addEventListener('calciteInputInput', () => {
        listFilters.layer.update();
      });
      tileFieldSearchInput.addEventListener('calciteInputInput', () => {
        listFilters.field.update();
      });

      /**
       * TILE SELECTED
       * @param {Field} acsField
       */
      const acsFieldTileSelected = (acsField) => {

        // INITIAL FIELD NAME //
        this.initialFieldName = acsField.name;

        // SET ACS SUMMARY FIELD //
        acsSummaryField.acsField = acsField;

        document.querySelectorAll('.stat-card').forEach(cardNode => {
          cardNode.toggleAttribute('hidden', !cardNode.dataset.type.split(',').includes(acsField.valueType));
        });

        this._evented.emit("source-change", {acsSummaryField});
      };

      /**
       *
       * @param {Field} acsLayerField
       * @param {number} acsLayerFieldIdx
       * @returns {HTMLElement}
       */
      const createFieldTile = (acsLayerField, acsLayerFieldIdx) => {

        const activeFieldName = (this.initialFieldName || acsSummaryField.acsLayer?.renderer.field);
        const isActiveField = (acsLayerField.name === activeFieldName);
        const valueTypeIcon = (acsLayerField.valueType === 'count-or-amount') ? 'number' : 'percent';

        const templateNode = acsFieldTileTemplate.content.cloneNode(true);

        const tileNode = templateNode.querySelector('calcite-tile-select');
        tileNode.setAttribute('heading', acsLayerField.alias);
        tileNode.setAttribute('description', acsLayerField.description);
        tileNode.setAttribute('value', acsLayerField.name);
        tileNode.setAttribute('title', acsLayerField.name);
        tileNode.setAttribute('icon', valueTypeIcon);
        tileNode.toggleAttribute('checked', isActiveField);
        tileNode.setAttribute('data-sortalpha', acsLayerField.alias);
        tileNode.setAttribute('data-sorttable', String(acsLayerFieldIdx));

        tileNode.addEventListener('calciteTileSelectChange', () => {
          acsFieldTileSelected(acsLayerField);
        });

        if (isActiveField) {
          acsFieldTileSelected(acsLayerField);
        }

        return tileNode;
      };

      const oidCountStat = {statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'COUNT'};
      let _outStatistics = [oidCountStat];

      this._evented.on("source-change", ({}) => {

        _outStatistics = [oidCountStat];

        if (acsSummaryField.valid && acsSummaryField.numerator) {
          _outStatistics.push({
            statisticType: 'sum',
            onStatisticField: acsSummaryField.numerator.name,
            outStatisticFieldName: 'NUMERATOR_SUM'
          });
          _outStatistics.push({
            statisticType: 'sum',
            onStatisticField: `(${ acsSummaryField.numerator_moe.name } * ${ acsSummaryField.numerator_moe.name })`,
            outStatisticFieldName: 'NUMERATOR_MOE_SUM_SQ'
          });
        }

        if (acsSummaryField.valid && acsSummaryField.denominator) {
          _outStatistics.push({
            statisticType: 'sum',
            onStatisticField: acsSummaryField.denominator.name,
            outStatisticFieldName: 'DENOMINATOR_SUM'
          });
          _outStatistics.push({
            statisticType: 'sum',
            onStatisticField: `(${ acsSummaryField.denominator_moe.name } * ${ acsSummaryField.denominator_moe.name })`,
            outStatisticFieldName: 'DENOMINATOR_MOE_SUM_SQ'
          });
        }

        watchUtils.whenFalseOnce(view, 'updating', () => {
          _updateStatistics(_geometry);
        });

      });

      // GET STATISTICS //
      const _getStatistics = promiseUtils.debounce((queryGeom) => {
        return promiseUtils.create((resolve, reject) => {

          if (acsSummaryField.valid && acsSummaryField.acsLayerView) {
            watchUtils.whenNotOnce(acsSummaryField.acsLayerView, "updating", () => {
              const statsQuery = acsSummaryField.acsLayerView.createQuery();
              statsQuery.set({
                where: `1=1`,
                geometry: queryGeom,
                outFields: ['OBJECTID', ...acsSummaryField.fieldNames],
                outStatistics: _outStatistics
              });
              acsSummaryField.acsLayerView.queryFeatures(statsQuery).then(statsFeatureSet => {
                resolve(statsFeatureSet.features[0].attributes);
              }).catch(reject);
            });
          } else { resolve(); }
        });
      });

      // ACS LAYER BY ITEM ID //
      const tractCentroidsLayersByItemId = new Map();

      /**
       *
       * @param {Polygon} geometry
       * @private
       */
      const _updateStatistics = (geometry) => {
        if (geometry) {
          _getStatistics(geometry).then((statInfos) => {
            acsSummaryResults.updateResults(statInfos);
          }).catch(error => {
            if (error.name !== 'AbortError') {
              acsSummaryResults.clearResults();
              console.error(error);
            }
          });
        } else { acsSummaryResults.clearResults(); }
      };

      let _geometry = null;
      this._evented.on('analysis-geometry', ({geometry}) => {
        _geometry = geometry;
        _updateStatistics(_geometry);
      });

      //
      // CREATE LIST OF ALL ACS CENTROID LAYERS IN THIS GROUP //
      //

      /**
       *
       * @param {PortalItem} acsLayerItem
       * @returns {Promise<FeatureLayer>}
       */
      const getTractCentroidLayer = async (acsLayerItem) => {
        return new Promise((resolve, reject) => {
          Layer.fromPortalItem({portalItem: acsLayerItem}).then(groupLayer => {
            groupLayer.loadAll().then(() => {
              resolve(groupLayer.layers.find(layer => layer.title === 'Tract'));
            }).catch(reject);
          }).catch(reject);
        });
      };

      /**
       *
       * @returns {Promise<Map<string,PortalItem>>}
       */
      const excludedItemIDs = ['f58f4bebb8ed416dba8668d8cf39553c'];

      const getACSLayerItems = () => {
        return new Promise((resolve, reject) => {
          this.acsGroup.queryItems({
            query: ``,
            categories: ['/Categories/Centroids'],
            sortField: 'title',
            sortOrder: 'asc',
            num: 100
          }).then((queryGroupResults) => {

            const itemsById = queryGroupResults.results.reduce((infos, item) => {
              if (!excludedItemIDs.includes(item.id)) {
                infos.set(item.id, item);
              }
              return infos;
            }, new Map());

            resolve(itemsById);
          });
        });
      };

      //
      // FIND ALL ACS CENTROID LAYERS IN THIS GROUP //
      //
      getACSLayerItems().then((itemsById) => {

        /**
         *
         * @param {string} layerItemId
         * @returns {Promise<void>}
         */
        const layerTileSelected = (layerItemId) => {
          return new Promise(async (resolve, reject) => {

            const acsLayerItem = itemsById.get(layerItemId);

            let acsTractCentroidLayer = tractCentroidsLayersByItemId.get(acsLayerItem.id);
            if (!acsTractCentroidLayer) {
              // SET ACC TRACTS CENTROID LAYER //
              acsTractCentroidLayer = await getTractCentroidLayer(acsLayerItem);
              acsTractCentroidLayer.set({outFields: ["*"]});

              tractCentroidsLayersByItemId.set(acsLayerItem.id, acsTractCentroidLayer);
            }

            // ACS LAYER //
            acsSummaryField.acsLayer = acsTractCentroidLayer;

            // INITIAL LAYER TITLE //
            this.initialLayerTitle = acsTractCentroidLayer.title;

            // VALID STATISTIC FIELD //
            const statisticFields = acsSummaryField.getValidFields();
            if (statisticFields.length) {

              // MAKE FIELDS TAB ACTIVE //
              acsFieldTabTitle.active = true;
              activateSearchInput('acs-field');

              // ADD FIELD ITEMS TO LIST //
              acsFieldList.replaceChildren(...statisticFields.map(createFieldTile));
              // SORT FIELDS LIST //
              sortFieldsList();
              // RESET THE FIELDS FILTER //
              listFilters.field.clear();

              // SCROLL TO SELECTED FIELD TILE //
              this.scrollToSelectedFieldTile().then((selectedFieldTile) => {
                if (!selectedFieldTile) {
                  //console.warn(`[ Can't find renderer field ][ ${ acsSummaryField.acsLayer.portalItem.id } ] [ ${ acsSummaryField.acsLayer.title } ] [ ${ acsSummaryField.acsLayer.renderer.field } ]`, acsSummaryField.acsLayer.renderer);

                  // SELECT FIRST FIELD //
                  selectedFieldTile = acsFieldList.querySelectorAll('calcite-tile-select')[0];
                  selectedFieldTile.toggleAttribute('checked', true);
                  acsFieldTileSelected(statisticFields[0]);
                }

                resolve(statisticFields);
              });

            } else {
              console.warn(`[ No valid Margin Of Error statistics fields available ][ ${ acsSummaryField.acsLayer.portalItem.id } ] [ ${ acsSummaryField.acsLayer.title } ]`);
              reject();
            }
          });
        };

        this.scrollToSelectedFieldTile = () => {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              // CHECK TO SEE IF WE HAVE A DEFAULT CHECKED FIELD TILE //
              let selectedFieldTile = acsFieldList.querySelector('calcite-tile-select[checked]');
              // SCROLL INTO VIEW //
              selectedFieldTile?.scrollIntoView({behavior: 'smooth', block: 'center'});
              resolve(selectedFieldTile);
            }, 500);
          });
        };

        /**
         *
         * @param {PortalItem} acsLayerItem
         * @param {number} acsLayerItemIdx
         * @returns {HTMLElement}
         */
        const createLayerTile = (acsLayerItem, acsLayerItemIdx) => {

          const isActive = acsLayerItem.title.includes(this.initialLayerTitle);

          const templateNode = acsLayerTileTemplate.content.cloneNode(true);
          const tileNode = templateNode.querySelector('calcite-tile-select');
          tileNode.setAttribute('heading', acsLayerItem.title.replace(/ - Centroids/, ''));
          tileNode.setAttribute('description', acsLayerItem.snippet);
          tileNode.setAttribute('value', acsLayerItem.id);
          tileNode.setAttribute('href', acsLayerItem.url);
          tileNode.toggleAttribute('checked', isActive);

          tileNode.addEventListener('calciteTileSelectChange', () => {
            layerTileSelected(acsLayerItem.id).catch(error => {
              this.displayAlert({title: `Invalid Layer Removed: ${ acsLayerItem.title }`, message: error.message});
              tileNode.remove();
              selectInitialLayerItem();
            });
          });

          return tileNode;
        };

        //
        // CREATE LAYER ITEM TILES //
        //
        const acsLayerItems = Array.from(itemsById.values());
        const acsLayerTiles = acsLayerItems.map(createLayerTile);
        acsLayerList.append(...acsLayerTiles);

        //
        // SELECT INITIAL LAYER ITEM //
        //
        const selectInitialLayerItem = () => {
          // FIND INITIAL LAYER ITEM //
          const initialLayerTile = acsLayerList.querySelector(`calcite-tile-select[checked]`);
          if (initialLayerTile) {
            initialLayerTile.toggleAttribute('checked', true);
            initialLayerTile.scrollIntoView({behavior: 'smooth', block: 'center', inline: 'center'});
            layerTileSelected(initialLayerTile.getAttribute('value')).then();
          }
        };

        // SELECT INITIAL LAYER ITEM //
        selectInitialLayerItem();

      });
    });
  }

  /**
   *
   * https://developers.arcgis.com/javascript/latest/visualization/symbols-color-ramps/esri-color-ramps/
   *
   * COLOR
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-smartMapping-renderers-color.html
   *
   * SIZE
   * https://developers.arcgis.com/javascript/latest/api-reference/esri-smartMapping-renderers-size.html
   *
   * @param view
   */
  initializeACSLayerRendering(view) {
    require([
      "esri/core/reactiveUtils",
      "esri/smartMapping/popup/templates",
      "esri/smartMapping/symbology/support/colorRamps",
      "esri/smartMapping/symbology/color",
      "esri/smartMapping/renderers/color",
      "esri/smartMapping/renderers/size",
      "esri/smartMapping/renderers/opacity",
      "esri/smartMapping/renderers/univariateColorSize"
    ], (reactiveUtils, popupTemplateCreator, colorRamps, colorSchemes, colorRendererCreator, sizeRendererCreator, opacityVariableCreator) => {

      // SMARTMAPPING POPUP //
      const _setSmartMappingPopup = (layer, places) => {
        popupTemplateCreator.getTemplates({layer: layer, renderer: layer.renderer}).then((popupTemplateResponse) => {
          if (popupTemplateResponse.primaryTemplate) {
            const suggestedTemplate = popupTemplateResponse.primaryTemplate.value;
            suggestedTemplate.fieldInfos[0].format.places = places;
            layer.popupTemplate = suggestedTemplate;
          }
        }).catch(console.error);
      };

      // DATA THEME //
      const dataTheme = 'high-to-low';

      // NARROW DOWN TO SOME SCHEMES //
      const someColorSchemes = colorSchemes.getSchemesByTag({
        includedTags: ['reds', 'light', 'sequential', '3d', 'colorblind-friendly'],
        theme: dataTheme,
        basemapTheme: 'light',
        geometryType: 'point'
      });
      // ALL SCHEMES NAMED RED 13 //
      const colorScheme = someColorSchemes.find(scheme => (scheme.name === 'Red 13') && (scheme.id === 'high-to-low/gray/seq-red-brown-white'));

      /*const colorScheme = colorSchemes.getSchemeByName({
       name: 'Red 13',
       theme: dataTheme,
       basemapTheme: 'light',
       geometryType: 'point'
       });*/

      const colorOptions = {
        colorScheme
      };

      const sizeOptions = {
        minValue: 10,
        sizeScheme: {
          minSize: 5,
          maxSize: 46
        }
      };

      const defaultSymbol = {
        'count-or-amount': {
          type: 'simple-marker',
          color: '#00bab5',
          size: 7.0,
          outline: {color: 'rgba(255,255,255,0.25)', width: 1.0}
        },
        'percentage-or-ratio': {
          type: 'simple-marker',
          color: '#aaaaaa',
          size: 7.0,
          outline: {color: 'rgba(153,153,153,0.25)', width: 0.5}
        }
      };

      this._evented.on("source-change", ({acsSummaryField}) => {
        if (acsSummaryField.valid) {

          const acsField = acsSummaryField.acsField;
          const acsLayer = acsSummaryField.acsLayer;
          //console.info(`${ acsLayer.title } | ${ acsSummaryField.valid } |  ${ acsField.name }`);

          const defaultRenderer = {
            type: (acsField.valueType === 'count-or-amount') ? 'simple' : 'class-breaks',
            symbol: defaultSymbol[acsField.valueType],
            defaultLabel: 'Other',
            defaultSymbol: defaultSymbol[acsField.valueType]
          };

          acsLayer.set({
            visible: false,
            orderBy: {field: acsField.name, order: 'descending'},
            renderer: defaultRenderer
          });

          // DEFAULT SMART MAPPING OPTIONS //
          const defaultOptions = {
            view: view,
            layer: acsLayer,
            field: acsField.name,
            theme: dataTheme,
            outlineOptimizationEnabled: true,
            sizeOptimizationEnabled: true,
            defaultSymbolEnabled: true
          };

          // OPACITY VV //
          const opacityVV = {
            type: 'opacity',
            field: acsField.name,
            legendOptions: {showLegend: false},
            stops: [
              {value: 0.0, opacity: 0.3},
              {value: 1.0, opacity: 1.0}
            ]
          };

          switch (acsField.valueType) {
            case 'percentage-or-ratio':

              // COLOR VISUAL VARIABLE //
              colorRendererCreator.createVisualVariable({...defaultOptions, ...colorOptions}).then((colorVVInfo) => {

                // COLOR VV //
                const colorVV = colorVVInfo.visualVariable;
                // ADJUST COLOR VV LABELS //
                colorVV.stops = colorVV.stops.map((colorStop, colorStopIdx) => {
                  switch (colorStopIdx) {
                    case 0:
                    case 4:
                      colorStop.label = `${ colorStop.value }%`;
                      break;
                    case 2:
                      colorStop.label = `${ colorStop.value }% - national average`;
                      break;
                  }
                  return colorStop;
                });

                acsLayer.set({
                  visible: true,
                  renderer: {
                    ...defaultRenderer,
                    visualVariables: [colorVV]
                  }
                });

                _setSmartMappingPopup(acsLayer, 1);
              });
              break;

            case 'count-or-amount':

              // SIZE VISUAL VARIABLE //
              sizeRendererCreator.createVisualVariables({...defaultOptions, ...sizeOptions}).then((sizeVVInfos) => {

                acsLayer.set({
                  visible: true,
                  renderer: {
                    ...defaultRenderer,
                    visualVariables: [...sizeVVInfos.visualVariables, opacityVV]
                  }
                });

                _setSmartMappingPopup(acsLayer, 0);
              });

              break;
          }

        }
      });

    });
  }

}

export default new Application();

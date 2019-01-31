import {
    defineWidget,
    log,
    runCallback,
} from 'widget-base-helpers';

import $ from "dojo/query";
import "dojo/NodeList-traverse";
import aspect from "dojo/aspect";
import registry from "dijit/registry";
import dojoClass from "dojo/dom-class";
//import on from "dojo/on";

//import $ from "jquery";
import './ListViewTableControls.scss';

export default defineWidget('ListViewTableControls', false, {

    _obj: null,
    _tableSettings: null,
    _headerTable: null,
    _dataTables: null,
    _restoreButton: null,

    headerTableClass: "",
    dataTableClass: "",
    hideButtonClass: "",
    restoreButtonClass: "",

    constructor() {
        this.log = log.bind(this);
        //this.styles = styles;
        this.runCallback = runCallback.bind(this);
        this._tableSettings = [];
        this._dataTables = [];
    },

    postCreate() {
        log.call(this, 'postCreate', this._WIDGET_VERSION);

        //find the table
        const headerTableList = $(this.domNode.parentNode).children("." + this.headerTableClass);
        if (headerTableList.length > 0) {
            this._headerTable = headerTableList[0];
        }
        //find the restore button
        const restoreButtonList = $(this.domNode.parentNode).children("." + this.restoreButtonClass);
        if (restoreButtonList.length > 0) {
            this._restoreButton = restoreButtonList[0];
        }

        this._initHeaders();
        //add listener to the list view
        $(this.domNode.parentNode).children(".mx-listview").forEach(function(lvNode) {
            const lv = registry.byNode(lvNode);
            aspect.after(lv, "_flushItemsToDom", this._initDataTables.bind(this));
        }.bind(this));

    },

    _buildInitialSettings() {
        this._tableSettings = [];
        const numCols = $("colgroup", this._headerTable)[0].children.length;
        for(let i = 0; i < numCols; i++) {
            this._tableSettings.push({
                index: i,
                visible: true,
            });
        }
    },

    //Updates the given table to match the current visibility settings
    _updateColumnVisibility(tbl) {
        for (let i = 0; i < this._tableSettings.length; i++) {
            const vis = this._tableSettings[i].visible;
            const origIndex = this._tableSettings[i].index;
            //find the col and tds to show/hide
            $("[data-orig-index='" + origIndex + "']", tbl).forEach(function(col) {
                if(vis) {
                    dojoClass.remove(col, "hide-col");
                } else {
                    dojoClass.add(col, "hide-col");
                }
            });
        }
    },

    //Updates all tables to match the current visibility settings
    _updateAllColumnVisibility() {
        this._updateRestoreButtonVisibility();
        this._updateColumnVisibility(this._headerTable);
        this._dataTables.forEach(table => this._updateColumnVisibility(table));
    },

    //Updates visibility of the restore columns button
    _updateRestoreButtonVisibility() {
        const hiddenCols = this._tableSettings.filter(setting => setting.visible === false);
        if (hiddenCols && hiddenCols.length) {
            dojoClass.remove(this._restoreButton, "hide");
        } else{
            dojoClass.add(this._restoreButton, "hide");
        }
    },
    //Restores visibility to all columns
    _restoreAllColumns() {
        this._tableSettings.filter(setting => setting.visible === false).forEach(function(setting) {
            setting.visible = true; //eslint-disable-line no-param-reassign
        });
        this._updateAllColumnVisibility();
    },

    //Updates the given table to match the current column order
    _updateColumnOrder(table) {
        this._reorderColumn(table, this._getCurrentColumnOrder(table), this._getColumnOrder());
    },
    //Updates all tables to match the current column order
    _updateAllColumnOrder() {
        this._updateColumnOrder(this._headerTable);
        this._dataTables.forEach(table => this._updateColumnOrder(table));
    },

    //Given a table, get the current column order
    _getCurrentColumnOrder(tbl) {
        const order = [];
        $("colgroup col", tbl).forEach(function(el) {
            order.push(parseInt(el.dataset.origIndex, 10));
        });
        return order;
    },

    //Map the current column settings to an array that the column swapper can use.
    _getColumnOrder() {
        return this._tableSettings.map(setting => setting.index);
    },

    //sets initial attributes for a table (adds a data attribute indicating original column)
    _setGridColumnDataAttributes(tbl, isHeader) {

        $("colgroup col", tbl).forEach(function(el) {
            if(typeof el.dataset.origIndex !== "undefined") {
                return;
            }
            const index = Array.from(el.parentNode.children).indexOf(el);
            el.dataset.origIndex = index; //eslint-disable-line no-param-reassign
        });
        $("tbody tr td", tbl).forEach(function (el) {
            if(typeof el.dataset.origIndex !== "undefined") {
                return;
            }
            if(isHeader) {
                el.setAttribute("draggable", "true");
                el.ondrop = this._onDrop.bind(this); //eslint-disable-line no-param-reassign
                el.ondragstart = this._onDrag; //eslint-disable-line no-param-reassign
                el.ondragover = this._allowDrop; //eslint-disable-line no-param-reassign
            }
            const index = Array.from(el.parentNode.children).indexOf(el);
            el.dataset.origIndex = index; //eslint-disable-line no-param-reassign
        }.bind(this));

    },

    _updateDataTables() {
        this._dataTables = $("." + this.dataTableClass, this.domNode.parentNode);
    },

    //to be called after load of the list view
    _initDataTables() {
        //setup data tables
        this._updateDataTables();
        this._dataTables.forEach(tbl => this._setGridColumnDataAttributes(tbl, false));
        this._updateAllColumnOrder();
        this._updateAllColumnVisibility();
    },

    _initHeaders() {
        this._buildInitialSettings();

        //setup header table
        this._setGridColumnDataAttributes(this._headerTable, true);

        // hide columns on click
        $("." + this.hideButtonClass, this._headerTable).on("click", this._hideColumnOnClick.bind(this));

        // restore columns on click
        $("." + this.restoreButtonClass).on("click", this._restoreAllColumns.bind(this));
    },

    _allowDrop(ev) {
        ev.preventDefault();
    },

    _onDrag(ev) {
        ev.dataTransfer.setData("Index", ev.target.dataset.origIndex);
    },

    _onDrop(ev) {
        //get the drag and drop ORIGINAL indicies
        const origDragIndex = parseInt(ev.dataTransfer.getData("Index"), 10);
        const origDropIndex = parseInt(ev.currentTarget.dataset.origIndex, 10);

        const dragSetting = this._tableSettings.filter(setting => setting.index === origDragIndex)[0];
        const dropSetting = this._tableSettings.filter(setting => setting.index === origDropIndex)[0];

        const dragIndex = this._tableSettings.indexOf(dragSetting);
        const dropIndex = this._tableSettings.indexOf(dropSetting);

        this._moveEl(this._tableSettings, dragIndex, dropIndex);
        this._updateAllColumnOrder();

        /*this._reorderColumn(this._headerTable, beforeColOrder.slice(), targetColOrder);
        this._dataTables.forEach(function(table) {
            this._reorderColumn(table, beforeColOrder.slice(), targetColOrder);
        }.bind(this));*/
        ev.preventDefault();
    },

    //click handler for column hiding button. Should hide columns from header table and any data tables
    _hideColumnOnClick(ev) {
        const index = parseInt($(ev.currentTarget).closest("td")[0].dataset.origIndex, 10);

        this._tableSettings.filter(setting => setting.index === index).forEach(function(targetSetting) {
            targetSetting.visible = false; //eslint-disable-line no-param-reassign
        });
        this._updateAllColumnVisibility();
    },

    // Re-order table given arrays representing before and after states
    _reorderColumn(table, order0, order1) {

        // Check arrays are same length
        if (order0.length !== order1.length) {
            return;
        }

        // Check arrays have same elements
        const x = order0.concat().sort().join('');
        const y = order1.concat().sort().join('');
        if (x !== y) {
            return;
        }

        // Re-order the columns
        let j, i;
        const k = i = order0.length;
        while (i--) { // Compare each key
            if (order0[i] !== order1[i]) { // If one out of order
                j = this._newIdx(order0[i], order1); // Find new spot
                this._moveColumn(table, i, j); // Move the column
                this._moveEl(order0, i, j); // Move the key
                i = k; // Start key comparison again
            }
        }
    },

    // returns the position of element el in array ar
    // Assumes el is in ar
    _newIdx(el, ar) {
        let i = ar.length;
        while (ar[--i] !== el) { /*intentially empty*/ }
        return i;
    },

    // Move a column of table from start index to finish index
    // Assumes there are columns at sIdx and fIdx
    _moveColumn(table, sIdx, fIdx) {
        let row;
        let i = table.rows.length;
        while (i--) {
            row = table.rows[i];
            const x = row.removeChild(row.cells[sIdx]);
            row.insertBefore(x, row.cells[fIdx]);
        }
        //also do the same for colgroups
        const colgroup = $("colgroup", table)[0];
        const x2 = colgroup.removeChild(colgroup.childNodes[sIdx]);
        colgroup.insertBefore(x2, colgroup.childNodes[fIdx]);
    },

    // Move element in array ar from index i to index j
    // Assumes array has indexes i and j
    _moveEl(ar, i, j) {
        const x = ar.splice(i, 1);
        ar.splice(j, 0, x[0]);
        return ar; // Not needed, handy for debug
    },

});

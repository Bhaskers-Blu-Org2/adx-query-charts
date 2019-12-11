'use strict';

import * as _ from 'lodash';
import { Chart, ICategoriesAndSeries } from './chart';
import { TooltipHelper } from '../tooltipHelper';
import { IVisualizerOptions } from '../../IVisualizerOptions';
import { Utilities } from '../../../common/utilities';
import { IColumn, IChartOptions, DraftColumnType, DateFormat } from '../../../common/chartModels';

export class Pie extends Chart {
    //#region Methods override
 
    protected getChartType(): string {
        return 'pie';
    };

    protected plotOptions(): Highcharts.PlotOptions {
        return {
            pie: {
                innerSize: this.getInnerSize(),
                showInLegend: true
            }
        }
    }

    public getStandardCategoriesAndSeries(options: IVisualizerOptions): ICategoriesAndSeries {
        const xColumn: IColumn = options.chartOptions.columnsSelection.xAxis;
        const xAxisColumnIndex: number =  Utilities.getColumnIndex(options.queryResultData, xColumn);    
        const yAxisColumn = options.chartOptions.columnsSelection.yAxes[0]; // We allow only 1 yAxis in pie charts
        const yAxisColumnIndex = Utilities.getColumnIndex(options.queryResultData, yAxisColumn);

        // Build the data for the pie
        const pieSeries = {
            name: yAxisColumn.name,
            data: []
        }

        options.queryResultData.rows.forEach((row) => {
            const xAxisValue = row[xAxisColumnIndex];
            const yAxisValue = row[yAxisColumnIndex];

            pieSeries.data.push({
                name: xAxisValue,
                y: yAxisValue 
            })
        });

        return {
            series: [pieSeries]
        }
    }

    public getSplitByCategoriesAndSeries(options: IVisualizerOptions): ICategoriesAndSeries {
        const yAxisColumn = options.chartOptions.columnsSelection.yAxes[0]; // We allow only 1 yAxis in pie charts
        const yAxisColumnIndex = Utilities.getColumnIndex(options.queryResultData, yAxisColumn);
        const keyIndexes = this.getAllPieKeyIndexes(options);
        
        // Build the data for the multi-level pie
        let pieData = {};
        let pieLevelData = pieData;

        options.queryResultData.rows.forEach((row) => {
            const yAxisValue = row[yAxisColumnIndex];

            keyIndexes.forEach((keyIndex) => {  
                const keyValue: string = <string>row[keyIndex];
                let keysMap = pieLevelData[keyValue];

                if(!keysMap) {
                    pieLevelData[keyValue] = {
                        drillDown: {},
                        y: 0
                    };
                }

                pieLevelData[keyValue].y += yAxisValue;
                pieLevelData = pieLevelData[keyValue].drillDown;
            });

            pieLevelData = pieData;
        });

        const series = this.spreadMultiLevelSeries(options, pieData);

        return {
            series: series
        }
    }
  
    public getChartTooltipFormatter(chartOptions: IChartOptions): Highcharts.TooltipFormatterCallbackFunction {
        return function () {
            const context = this;
            let tooltip: string;

            // Key
            const splitBy = chartOptions.columnsSelection.splitBy;
            let keyColumn: IColumn;
            let keyColumnName: string;

            if(splitBy && splitBy.length > 0) {
                // Find the current key column
                const keyColumnIndex = _.findIndex(splitBy, (col) => { 
                    return col.name === this.series.name 
                });
    
                keyColumn = splitBy[keyColumnIndex];
            }

            // If the key column isn't one of the splitBy columns -> it's the y axis column
            if(!keyColumn) {
                keyColumn = chartOptions.columnsSelection.xAxis;
                keyColumnName = chartOptions.xAxisTitleFormatter ? chartOptions.xAxisTitleFormatter(keyColumn) : undefined;     
            }

            tooltip = TooltipHelper.getSingleTooltip(chartOptions, context, keyColumn, this.key, keyColumnName);  

            // Y axis
            const yColumn = chartOptions.columnsSelection.yAxes[0]; // We allow only 1 y axis in pie chart
            const yValueSuffix = Number(Math.round(<any>(context.percentage + 'e2')) + 'e-2'); // Round the percentage to up to 2 decimal points

            tooltip += TooltipHelper.getSingleTooltip(chartOptions, context, yColumn, this.y, /*columnName*/ undefined, ` (${yValueSuffix}%)`);

            return '<table>' + tooltip + '</table>';
        }
    }

    //#endregion Methods override

    protected getInnerSize(): string {
        return '0';
    }

    //#region Private methods

    private spreadMultiLevelSeries(options: IVisualizerOptions, pieData: any, level: number = 0, series: any[] = []): any[] {
        const chartOptions = options.chartOptions;
        const levelsCount = chartOptions.columnsSelection.splitBy.length + 1;
        const firstLevelSize =  Math.round(100 / levelsCount);

        for (let key in pieData) {
            let currentSeries = series[level];
            let pieLevelValue = pieData[key];

            if(!currentSeries) {
                let column = (level === 0) ? chartOptions.columnsSelection.xAxis : chartOptions.columnsSelection.splitBy[level - 1];
            
                currentSeries = {
                    name: column.name,
                    data: []
                };

                if(level === 0) {
                    currentSeries.size = `${firstLevelSize}%`;
                } else {
                    const prevLevelSizeStr = series[level - 1].size;
                    const prevLevelSize = Number(prevLevelSizeStr.substring(0, 2));

                    currentSeries.size = `${prevLevelSize + 10}%`;
                    currentSeries.innerSize = `${prevLevelSize}%`;
                }
            
                // We do not show labels for multi-level pie
                currentSeries.dataLabels = {
                    enabled: false
                }

                series.push(currentSeries);
            }
  
            currentSeries.data.push({
                name: key,
                y: pieLevelValue.y
            });

            let drillDown = pieLevelValue.drillDown;

            if(!_.isEmpty(drillDown)) {
                this.spreadMultiLevelSeries(options, drillDown, level + 1, series);
            }
        }

        return series;
    }

    /**
     * Returns an array that includes all the indexes of the columns that represent a pie slice key
     * @param chartOptions 
     */
    private getAllPieKeyIndexes(options: IVisualizerOptions) {
        const xColumn: IColumn = options.chartOptions.columnsSelection.xAxis;
        const xAxisColumnIndex: number =  Utilities.getColumnIndex(options.queryResultData, xColumn);
        const keyIndexes = [xAxisColumnIndex];
        
        options.chartOptions.columnsSelection.splitBy.forEach((splitByColumn) => {
            keyIndexes.push(Utilities.getColumnIndex(options.queryResultData, splitByColumn));
        });

        return keyIndexes;
    }

    //#endregion Private methods
}
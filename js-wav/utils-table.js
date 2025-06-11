"use strict";

const tableLine = (...values) => {
    const tdTags = values.map(value => '<td>' + value + '</td>').join('');
    return '<tr>' + tdTags + '</tr>';
};

// Create a subtitle row with special styling
const tableSubtitle = (...values) => {
    const tdTags = values.map(value => '<td>' + value + '</td>').join('');
    return '<tr class="table-subtitle">' + tdTags + '</tr>';
};

// Create a header row (title)
const tableHeader = (...values) => {
    const tdTags = values.map(value => '<td>' + value + '</td>').join('');
    return '<tr class="table-header">' + tdTags + '</tr>';
};

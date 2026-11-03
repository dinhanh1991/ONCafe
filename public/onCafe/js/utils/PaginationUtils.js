export function createPaginationMarkup({
    currentPage,
    totalPages,
    firstItem,
    lastItem,
    totalItems,
    itemLabel,
    pageKey
}) {
    const pageNumbers = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((first, second) => first - second);
    const pageButtons = pageNumbers.map((page, index) => {
        const previousPage = pageNumbers[index - 1];
        const separator = previousPage && page - previousPage > 1
            ? '<span class="pagination-ellipsis" aria-hidden="true">…</span>'
            : "";
        return `${separator}<button class="button button-small pagination-page-button" type="button" data-${pageKey}-page="${page}" aria-label="Trang ${page}"${page === currentPage ? ' aria-current="page"' : ""}>${page}</button>`;
    }).join("");

    return `<span>Hiển thị ${firstItem}–${lastItem} / ${totalItems} ${itemLabel}</span>
        <div class="pagination-actions">
            <button class="button button-small pagination-direction-button" type="button" data-${pageKey}-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>Trước</button>
            ${pageButtons}
            <button class="button button-small pagination-direction-button" type="button" data-${pageKey}-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Sau</button>
        </div>`;
}

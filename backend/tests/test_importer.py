"""Tests del importador de tablas (autodetección de separador y decimal)."""
import io

import pytest
from openpyxl import Workbook

from app.importer import ImportError_, parse_excel, parse_table


def test_csv_with_header_comma():
    text = "x,y\n1.0,2.0\n2.0,4.1\n3.0,6.0\n"
    r = parse_table(text)
    assert r.columns == ["x", "y"]
    assert r.n_rows == 3
    assert r.rows[0] == [1.0, 2.0]


def test_semicolon_and_comma_decimal_spanish():
    # Formato español típico: separador ';' y decimal ','.
    text = "tiempo;voltaje\n0,0;3,1\n1,0;5,4\n2,0;6,9\n"
    r = parse_table(text)
    assert r.columns == ["tiempo", "voltaje"]
    assert r.rows[0] == [0.0, 3.1]
    assert r.rows[1] == [1.0, 5.4]


def test_whitespace_separated_no_header():
    text = "0.35 0.03\n0.86 0.08\n1.37 0.12\n"
    r = parse_table(text)
    assert r.n_cols == 2
    assert r.n_rows == 3
    assert r.rows[0][0] == 0.35


def test_tab_separated():
    text = "a\tb\n1\t10\n2\t20\n"
    r = parse_table(text)
    assert r.n_cols == 2
    assert r.rows[1] == [2.0, 20.0]


def test_infers_roles_from_header_names():
    text = "Tiempo (s),Voltaje (V),error_y\n1,3.1,0.1\n2,5.4,0.1\n3,6.9,0.1\n"
    r = parse_table(text)
    assert r.roles == ["x", "y", "ey"]


def test_drops_empty_leading_columns_and_infers_xy():
    # Datos en la 3a y 4a columna (1a y 2a vacías): deben ser X, Y (no errores).
    text = "a,b,c,d\n,,1,10\n,,2,20\n,,3,30\n"
    r = parse_table(text)
    # Las columnas vacías se descartan; quedan c y d.
    assert r.columns == ["c", "d"]
    assert r.roles == ["x", "y"]


def test_infers_xy_positionally_without_headers():
    text = "0.1 2.0\n0.2 3.9\n0.3 6.1\n0.4 8.0\n"
    r = parse_table(text)
    assert r.roles[:2] == ["x", "y"]


def _xlsx(filas: list[list[object]]) -> bytes:
    """Construye un .xlsx en memoria para los tests."""
    libro = Workbook()
    hoja = libro.active
    for fila in filas:
        hoja.append(fila)
    buf = io.BytesIO()
    libro.save(buf)
    return buf.getvalue()


def test_xlsx_real_binary_file():
    """Un .xlsx es un ZIP binario: hay que leerlo con parse_excel, no parse_table."""
    contenido = _xlsx(
        [["tiempo", "voltaje"], [0.0, 3.1], [1.0, 5.4], [2.0, 6.9]]
    )
    r = parse_excel(contenido, filename="datos.xlsx")
    assert r.columns == ["tiempo", "voltaje"]
    assert r.n_rows == 3
    assert r.rows[0] == [0.0, 3.1]
    assert r.rows[2] == [2.0, 6.9]


def test_xlsx_ignores_trailing_empty_rows():
    contenido = _xlsx([["x", "y"], [1.0, 2.0], [None, None], [None, None]])
    r = parse_excel(contenido, filename="datos.xlsx")
    assert r.n_rows == 1


def test_xlsx_without_header_row():
    contenido = _xlsx([[0.1, 2.0], [0.2, 3.9], [0.3, 6.1]])
    r = parse_excel(contenido, filename="datos.xlsx")
    assert r.n_rows == 3
    assert r.rows[0] == [0.1, 2.0]


def test_old_xls_is_rejected_with_a_clear_message():
    with pytest.raises(ImportError_, match="guárdalo como .xlsx"):
        parse_excel(b"cualquier cosa", filename="antiguo.xls")


def test_csv_with_comment_lines():
    text = "# medidas del 12/03\nx,y\n1,2\n2,4\n"
    r = parse_table(text)
    assert r.columns == ["x", "y"]
    assert r.n_rows == 2

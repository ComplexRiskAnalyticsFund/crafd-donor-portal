from pathlib import Path


def export_dataframe(df, filename_base: str, output_dir: Path = Path(".")):
    print("\nExporting...")
    output_dir.mkdir(parents=True, exist_ok=True)

    csv_path = output_dir / f"{filename_base}.csv"
    df.to_csv(csv_path, index=False)
    print(f" ✓ Exported CSV to: {csv_path}")

    parquet_path = output_dir / f"{filename_base}.parquet"
    df.to_parquet(parquet_path, index=False)
    print(f" ✓ Exported Parquet to: {parquet_path}")


def convert_linked_columns_to_lists(df, linked_columns):
    """
    Convert linked columns from comma-separated strings to lists.

    Args:
        df: DataFrame to process
        linked_columns: List of column names to convert

    Returns:
        DataFrame with converted columns
    """
    for col in linked_columns:
        if col in df.columns:
            df[col] = df[col].fillna("")
            df[col] = df[col].apply(
                lambda x: [item.strip() for item in x.split(", ")] if x.strip() else []
            )
            print(f"Processed linked column: '{col}'")
    return df

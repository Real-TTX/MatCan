using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DesignThix.Data.Migrations
{
    /// <inheritdoc />
    public partial class Output : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FileNamePattern",
                table: "OutputJob",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "{Design}-{Nr}");

            migrationBuilder.AddColumn<string>(
                name: "Scale",
                table: "OutputJob",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "Fit");

            migrationBuilder.AddColumn<int>(
                name: "StartPosition",
                table: "OutputJob",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileNamePattern",
                table: "OutputJob");

            migrationBuilder.DropColumn(
                name: "Scale",
                table: "OutputJob");

            migrationBuilder.DropColumn(
                name: "StartPosition",
                table: "OutputJob");
        }
    }
}

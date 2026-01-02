require "time"

desc "Create a new post"
task :post do
  title = ENV["title"] || "new-post"
  slug = ENV["slug"] || title.downcase.strip.gsub(' ', '-').gsub(/[^\w-]/, '')
  date = Time.now
  filename = "_posts/#{date.strftime('%Y-%m-%d')}-#{slug}.md"

  File.open(filename, "w") do |f|
    f.puts <<~EOF
      ---
      layout:     post
      title:      "#{title}"
      date:       #{date.iso8601}
      categories:
      ---
    EOF
  end

  puts "Created #{filename}"
end
